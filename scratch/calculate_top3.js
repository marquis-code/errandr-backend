const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/?appName=errandr';
  await mongoose.connect(uri);
  console.log("Connected to MongoDB!");

  // List dbs and check which db has orders
  const admin = mongoose.connection.db.admin();
  const dbs = await admin.listDatabases();
  console.log("Databases:", dbs.databases.map(d => d.name));

  // Check current db collections
  console.log("Current DB name:", mongoose.connection.db.databaseName);
  let db = mongoose.connection.db;

  // Let's see if orders are in this db or another (like 'erranders')
  let orderCount = await db.collection('orders').countDocuments();
  console.log(`Orders in ${db.databaseName}:`, orderCount);

  if (orderCount === 0) {
    for (const d of dbs.databases) {
      if (['admin', 'local'].includes(d.name)) continue;
      const otherDb = mongoose.connection.client.db(d.name);
      const count = await otherDb.collection('orders').countDocuments();
      console.log(`Orders in ${d.name}:`, count);
      if (count > orderCount) {
        db = otherDb;
        orderCount = count;
      }
    }
  }

  console.log(`Using DB: ${db.databaseName} with ${orderCount} orders`);

  // Let's check min and max dates of orders
  const oldestOrder = await db.collection('orders').find().sort({ createdAt: 1 }).limit(1).toArray();
  const newestOrder = await db.collection('orders').find().sort({ createdAt: -1 }).limit(1).toArray();
  console.log("Oldest order date:", oldestOrder[0]?.createdAt);
  console.log("Newest order date:", newestOrder[0]?.createdAt);

  // Let's check status distributions
  const statuses = await db.collection('orders').aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]).toArray();
  console.log("Order statuses:", statuses);

  const paymentStatuses = await db.collection('orders').aggregate([
    { $group: { _id: "$paymentStatus", count: { $sum: 1 } } }
  ]).toArray();
  console.log("Payment statuses:", paymentStatuses);

  // Let's define periods:
  // 1. Current Month (e.g., October 2026 or whatever the newest month in DB is)
  const now = newestOrder[0]?.createdAt ? new Date(newestOrder[0].createdAt) : new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  console.log("\nPeriods to check:");
  console.log("1. Current Month Range:", startOfThisMonth.toISOString(), "to", now.toISOString());
  console.log("2. Previous Month Range:", startOfLastMonth.toISOString(), "to", endOfLastMonth.toISOString());
  console.log("3. All Time");

  async function analyzePeriod(label, dateFilter) {
    console.log(`\n==================================================`);
    console.log(`ANALYSIS FOR: ${label}`);
    console.log(`==================================================`);

    const matchQuery = { ...dateFilter };

    // Valid completed/paid orders condition:
    // usually status: { $nin: ['cancelled', 'refunded'] } or paymentStatus: 'paid'
    // Let's inspect both all orders and completed/valid orders
    const validOrderMatch = {
      ...dateFilter,
      status: { $nin: ['cancelled', 'refunded'] }
    };

    // 1. Top Vendors by sales amount and order count
    const topVendorsSales = await db.collection('orders').aggregate([
      { $match: { ...validOrderMatch, vendor: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$vendor",
          orderCount: { $sum: 1 },
          totalSales: { $sum: { $ifNull: ["$total", 0] } },
          subtotalSales: { $sum: { $ifNull: ["$subtotal", 0] } }
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 5 }
    ]).toArray();

    // Populate vendor info
    for (const v of topVendorsSales) {
      const vendorDoc = await db.collection('vendors').findOne({ _id: v._id });
      v.vendorName = vendorDoc?.businessName || vendorDoc?.name || "Unknown Vendor";
      v.ownerId = vendorDoc?.owner || vendorDoc?.user;
      v.email = vendorDoc?.email;
      v.phone = vendorDoc?.phone;
    }

    console.log(`\n--- Top Vendors by Sales Volume (GMV) ---`);
    topVendorsSales.slice(0, 3).forEach((v, i) => {
      console.log(`${i + 1}. ${v.vendorName} (ID: ${v._id})`);
      console.log(`   Total Sales: ₦${v.totalSales.toLocaleString()} | Orders: ${v.orderCount}`);
    });

    const topVendorsOrders = await db.collection('orders').aggregate([
      { $match: { ...validOrderMatch, vendor: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$vendor",
          orderCount: { $sum: 1 },
          totalSales: { $sum: { $ifNull: ["$total", 0] } }
        }
      },
      { $sort: { orderCount: -1 } },
      { $limit: 5 }
    ]).toArray();

    for (const v of topVendorsOrders) {
      const vendorDoc = await db.collection('vendors').findOne({ _id: v._id });
      v.vendorName = vendorDoc?.businessName || vendorDoc?.name || "Unknown Vendor";
    }

    console.log(`\n--- Top Vendors by Number of Orders Sold ---`);
    topVendorsOrders.slice(0, 3).forEach((v, i) => {
      console.log(`${i + 1}. ${v.vendorName} (ID: ${v._id})`);
      console.log(`   Orders Sold: ${v.orderCount} | Total Sales: ₦${v.totalSales.toLocaleString()}`);
    });

    // 2. Top Errand Ninjas (errander)
    // Who ran the most errands: orders where errander is assigned and status is delivered/completed
    const topErranders = await db.collection('orders').aggregate([
      { $match: { ...validOrderMatch, errander: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$errander",
          errandCount: { $sum: 1 },
          deliveredCount: {
            $sum: { $cond: [{ $in: ["$status", ["delivered", "completed"]] }, 1, 0] }
          },
          totalEarningsDeliveryFee: { $sum: { $ifNull: ["$agreedDeliveryFee", "$deliveryFee", 0] } }
        }
      },
      { $sort: { errandCount: -1 } },
      { $limit: 5 }
    ]).toArray();

    for (const e of topErranders) {
      const userDoc = await db.collection('users').findOne({ _id: e._id });
      e.name = `${userDoc?.firstName || ''} ${userDoc?.lastName || ''}`.trim() || userDoc?.name || "Unknown Ninja";
      e.email = userDoc?.email;
      e.phone = userDoc?.phone || userDoc?.phoneNumber;
    }

    console.log(`\n--- Top Errand Ninjas (by Errands Ran) ---`);
    topErranders.slice(0, 3).forEach((e, i) => {
      console.log(`${i + 1}. ${e.name} (ID: ${e._id})`);
      console.log(`   Errands Ran: ${e.errandCount} (Delivered: ${e.deliveredCount}) | Email: ${e.email} | Phone: ${e.phone}`);
    });

    // 3. Top Customers (customer)
    // Who made the most orders
    const topCustomers = await db.collection('orders').aggregate([
      { $match: { ...validOrderMatch, customer: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$customer",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: { $ifNull: ["$total", 0] } }
        }
      },
      { $sort: { orderCount: -1 } },
      { $limit: 5 }
    ]).toArray();

    for (const c of topCustomers) {
      const userDoc = await db.collection('users').findOne({ _id: c._id });
      c.name = `${userDoc?.firstName || ''} ${userDoc?.lastName || ''}`.trim() || userDoc?.name || "Unknown Customer";
      c.email = userDoc?.email;
      c.phone = userDoc?.phone || userDoc?.phoneNumber;
    }

    console.log(`\n--- Top Customers (by Orders Placed) ---`);
    topCustomers.slice(0, 3).forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} (ID: ${c._id})`);
      console.log(`   Orders Placed: ${c.orderCount} | Total Spent: ₦${c.totalSpent.toLocaleString()} | Email: ${c.email} | Phone: ${c.phone}`);
    });
  }

  // Run analysis for This Month
  await analyzePeriod(`Current Month (${startOfThisMonth.toLocaleDateString()} - Present)`, {
    createdAt: { $gte: startOfThisMonth }
  });

  // Run analysis for Last Month
  await analyzePeriod(`Previous Month (${startOfLastMonth.toLocaleDateString()} - ${endOfLastMonth.toLocaleDateString()})`, {
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
  });

  // Run analysis for Past 30 Days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await analyzePeriod(`Past 30 Days (${thirtyDaysAgo.toLocaleDateString()} - Present)`, {
    createdAt: { $gte: thirtyDaysAgo }
  });

  // Run analysis for All Time
  await analyzePeriod("All Time", {});

  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
