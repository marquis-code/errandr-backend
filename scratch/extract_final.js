const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

async function getDetails(db, periodName, dateFilter) {
  const matchFilter = {
    ...dateFilter,
    status: { $nin: ['cancelled', 'refunded'] } // only successful/active orders
  };

  // 1. Top 3 Vendors by Revenue (Sales Volume) AND by Number of Orders
  const topVendorsRevenue = await db.collection('orders').aggregate([
    { $match: { ...matchFilter, vendor: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$vendor",
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: { $ifNull: ["$total", 0] } },
        itemSubtotal: { $sum: { $ifNull: ["$subtotal", 0] } }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 5 }
  ]).toArray();

  for (const v of topVendorsRevenue) {
    const doc = await db.collection('vendors').findOne({ _id: v._id });
    v.name = doc?.storeName || doc?.businessName || doc?.name || "Unknown Store";
    v.category = doc?.category || doc?.vendorType || "N/A";
    v.phone = doc?.bankDetails?.accountNumber || doc?.phone || "N/A";
    v.address = doc?.address || "N/A";
  }

  const topVendorsCount = await db.collection('orders').aggregate([
    { $match: { ...matchFilter, vendor: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$vendor",
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: { $ifNull: ["$total", 0] } },
        itemSubtotal: { $sum: { $ifNull: ["$subtotal", 0] } }
      }
    },
    { $sort: { orderCount: -1 } },
    { $limit: 5 }
  ]).toArray();

  for (const v of topVendorsCount) {
    const doc = await db.collection('vendors').findOne({ _id: v._id });
    v.name = doc?.storeName || doc?.businessName || doc?.name || "Unknown Store";
    v.category = doc?.category || doc?.vendorType || "N/A";
  }

  // 2. Top 3 Errand Ninjas by Errands Ran
  const topNinjas = await db.collection('orders').aggregate([
    { $match: { ...matchFilter, errander: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$errander",
        totalErrands: { $sum: 1 },
        deliveredErrands: {
          $sum: { $cond: [{ $in: ["$status", ["delivered", "completed"]] }, 1, 0] }
        },
        customErrands: {
          $sum: { $cond: [{ $eq: ["$type", "custom_errand"] }, 1, 0] }
        },
        marketplaceErrands: {
          $sum: { $cond: [{ $eq: ["$type", "marketplace"] }, 1, 0] }
        }
      }
    },
    { $sort: { totalErrands: -1 } },
    { $limit: 5 }
  ]).toArray();

  for (const n of topNinjas) {
    const u = await db.collection('users').findOne({ _id: n._id });
    n.name = `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.name || "Unknown Ninja";
    n.email = u?.email || "N/A";
    n.phone = u?.phone || u?.phoneNumber || "N/A";
  }

  // 3. Top 3 Customers by Orders Made
  const topCustomers = await db.collection('orders').aggregate([
    { $match: { ...matchFilter, customer: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$customer",
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: { $ifNull: ["$total", 0] } }
      }
    },
    { $sort: { totalOrders: -1 } },
    { $limit: 5 }
  ]).toArray();

  for (const c of topCustomers) {
    const u = await db.collection('users').findOne({ _id: c._id });
    if (u) {
      c.name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name;
      c.email = u.email;
      c.phone = u.phone || u.phoneNumber;
    } else {
      // Find recipient details from orders
      const sampleOrder = await db.collection('orders').findOne({ customer: c._id, recipientName: { $exists: true, $ne: "" } });
      c.name = sampleOrder?.recipientName || "Unknown Customer";
      c.phone = sampleOrder?.recipientPhone || "N/A";
      c.email = "N/A";
    }
  }

  return {
    periodName,
    topVendorsRevenue: topVendorsRevenue.slice(0, 3),
    topVendorsCount: topVendorsCount.slice(0, 3),
    topNinjas: topNinjas.slice(0, 3),
    topCustomers: topCustomers.slice(0, 3)
  };
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const results = {
    thisMonth: await getDetails(db, "Current Month (October 2026)", { createdAt: { $gte: startOfThisMonth } }),
    lastMonth: await getDetails(db, "Previous Month (September 2026)", { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
    past30Days: await getDetails(db, "Rolling Past 30 Days", { createdAt: { $gte: thirtyDaysAgo } }),
    allTime: await getDetails(db, "All-Time", {})
  };

  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
