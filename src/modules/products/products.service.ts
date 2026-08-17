import { Injectable, NotFoundException } from '@nestjs/common';
import { checkIsOpen } from '../../utils/vendor-helpers';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from './schemas/product.schema';
import { ProductCategory } from './schemas/product-category.schema';
import { Pack } from './schemas/pack.schema';
import { VendorsService } from '../vendors/vendors.service';
import { GlobalProductsService } from '../global-products/global-products.service';
import { SystemSetting } from '../admin/schemas/system-setting.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(ProductCategory.name) private categoryModel: Model<ProductCategory>,
    @InjectModel(Pack.name) private packModel: Model<Pack>,
    @InjectModel(SystemSetting.name) private settingModel: Model<SystemSetting>,
    private vendorsService: VendorsService,
    private globalProductsService: GlobalProductsService,
  ) {}

  // ── Products ──

  async create(vendorId: string, data: Partial<Product>): Promise<Product> {
    if (!Types.ObjectId.isValid(vendorId)) {
      throw new NotFoundException('Invalid vendor ID');
    }
    
    if (!data.globalProductId) {
      const globalProd = await this.globalProductsService.findOrCreateManual(data.name || 'Unnamed Product', data.category, data.image);
      data.globalProductId = globalProd._id;
    } else {
      await this.globalProductsService.incrementAdoption(data.globalProductId as any);
    }
    
    return this.productModel.create({
      ...data,
      vendor: new Types.ObjectId(vendorId),
    });
  }

  async createForOwner(ownerId: string, data: Partial<Product>): Promise<Product> {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    
    if (!data.globalProductId) {
      const globalProd = await this.globalProductsService.findOrCreateManual(data.name || 'Unnamed Product', data.category, data.image);
      data.globalProductId = globalProd._id;
    } else {
      await this.globalProductsService.incrementAdoption(data.globalProductId as any);
    }
    
    return this.productModel.create({
      ...data,
      vendor: vendor._id,
    });
  }

  async getMarkupFactor(): Promise<number> {
    const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    const markupPct = errandSetting?.value?.foodMarkupPercentage ?? 5;
    return 1 + (markupPct / 100);
  }

  async applyMarkupToProduct(product: any, factor: number): Promise<any> {
    if (!product) return product;
    const pObj = typeof product.toObject === 'function' ? product.toObject() : product;
    if (pObj.price) pObj.price = Math.ceil(pObj.price * factor);
    if (pObj.bundlePrice) pObj.bundlePrice = Math.ceil(pObj.bundlePrice * factor);
    if (pObj.customizations) {
      pObj.customizations.forEach((c: any) => {
        if (c.options) {
          c.options.forEach((o: any) => {
            if (o.price) o.price = Math.ceil(o.price * factor);
          });
        }
      });
    }
    return pObj;
  }

  async applyMarkupToProducts(products: Product[]): Promise<any[]> {
    const factor = await this.getMarkupFactor();
    return Promise.all(products.map(p => this.applyMarkupToProduct(p, factor)));
  }

  async applyMarkupToPacks(packs: Pack[]): Promise<any[]> {
    const factor = await this.getMarkupFactor();
    return Promise.all(packs.map(async (pack) => {
      const pObj = typeof pack.toObject === 'function' ? pack.toObject() : pack;
      if (pObj.items) {
        for (const item of pObj.items) {
          if (item.itemId) {
            item.itemId = await this.applyMarkupToProduct(item.itemId, factor);
          }
        }
      }
      return pObj;
    }));
  }

  async findByVendor(vendorId: string): Promise<Product[]> {
    if (!Types.ObjectId.isValid(vendorId)) {
      return [];
    }
    const products = await this.productModel
      .find({ vendor: new Types.ObjectId(vendorId) })
      .sort({ category: 1, name: 1 });
    return this.applyMarkupToProducts(products);
  }

  async getPromos(): Promise<Product[]> {
    const products = await this.productModel
      .find({ isPrepaidByPlatform: true })
      .populate('vendor', 'storeName logo brandColor isOnline isVisible')
      .sort({ createdAt: -1 });
    return this.applyMarkupToProducts(products);
  }

  async getAllPromos(): Promise<any[]> {
    try {
      const factor = await this.getMarkupFactor().catch(() => 1.05);

      const products = await this.productModel
        .find({ isPrepaidByPlatform: true, isAvailable: true })
        .populate('vendor', 'storeName logo brandColor isOnline isVisible prepaidPromo businessHours breakPeriod')
        .sort({ createdAt: -1 })
        .lean()
        .exec()
        .catch(() => []);
        
      const packs = await this.packModel
        .find({ isPrepaidByPlatform: true, isActive: true })
        .populate('vendorId', 'storeName logo brandColor isOnline isVisible prepaidPromo businessHours breakPeriod')
        .populate('items.itemId')
        .sort({ createdAt: -1 })
        .lean()
        .exec()
        .catch(() => []);

      let menuPacks: any[] = [];
      try {
        menuPacks = await this.productModel.db.collection('menupacks')
          .find({ isPrepaidByPlatform: true, isAvailable: true })
          .sort({ createdAt: -1 })
          .toArray();
      } catch (err) {
        console.error('Error fetching menupacks:', err);
      }

      let menuItems: any[] = [];
      try {
        menuItems = await this.productModel.db.collection('menuitems')
          .find({ isPrepaidByPlatform: true, isAvailable: true })
          .sort({ createdAt: -1 })
          .toArray();
      } catch (err) {
        console.error('Error fetching menuitems:', err);
      }

      const vendorIds = new Set<string>();
      [...menuPacks, ...menuItems].forEach(p => {
        if (p.vendorId) {
          const idStr = typeof p.vendorId === 'string' ? p.vendorId : (p.vendorId._id ? p.vendorId._id.toString() : p.vendorId.toString());
          if (Types.ObjectId.isValid(idStr)) {
            vendorIds.add(idStr);
          }
        }
      });
      
      let vendors: any[] = [];
      try {
        vendors = await this.productModel.db.collection('vendors').find({
          _id: { $in: Array.from(vendorIds).map((id: string) => new Types.ObjectId(id)) }
        }).toArray();
      } catch (err) {
        console.error('Error fetching vendors for menu packs/items:', err);
      }
      
      const vendorMap = new Map();
      vendors.forEach(v => {
        const { isOpen, message } = checkIsOpen(v);
        vendorMap.set(v._id.toString(), {
          _id: v._id,
          storeName: v.storeName,
          logo: v.logo,
          brandColor: v.brandColor,
          isOnline: v.isOnline,
          isVisible: v.isVisible,
          prepaidPromo: v.prepaidPromo,
          businessHours: v.businessHours,
          breakPeriod: v.breakPeriod,
          isOpen: isOpen,
          statusMessage: message
        });
      });
      
      [...menuPacks, ...menuItems].forEach(p => {
        if (p.vendorId) {
          const vidStr = typeof p.vendorId === 'string' ? p.vendorId : (p.vendorId._id ? p.vendorId._id.toString() : p.vendorId.toString());
          if (vendorMap.has(vidStr)) {
            p.vendorId = vendorMap.get(vidStr);
          }
        }
      });

      const factorProducts = await this.applyMarkupToProducts(products as any);
      const factorPacks = await this.applyMarkupToPacks(packs as any);
      
      const factorMenuPacks = menuPacks.map(p => {
        if (p.price) p.price = Math.ceil(p.price * factor);
        if (p.bundlePrice) p.bundlePrice = Math.ceil(p.bundlePrice * factor);
        return p;
      });
      
      const factorMenuItems = menuItems.map(p => {
        if (p.pricePerPortion) p.pricePerPortion = Math.ceil(p.pricePerPortion * factor);
        return p;
      });
      
      let promoVendors: any[] = [];
      try {
        promoVendors = await this.productModel.db.collection('vendors').find({
          'prepaidPromo.enabled': true,
          isVisible: true
        }).toArray();
      } catch (err) {
        console.error('Error fetching promoVendors:', err);
      }

      const vendorPromos = promoVendors.map(v => {
        const p = v.prepaidPromo || {};
        const maxOrders = p.maxOrders || 0;
        const usedOrders = p.usedOrders || 0;
        const slotsLeft = maxOrders - usedOrders;
        
        return {
          _id: v._id,
          name: p.label || `${v.storeName} Promo`,
          description: p.description || `Spend ₦${p.budgetPerOrder || 0}, Get ₦${p.discountValue || 1000} Off (${slotsLeft} slots left!)`,
          price: (p.budgetPerOrder || 0) - (p.discountValue || 1000),
          originalPrice: p.budgetPerOrder || 0,
          vendorId: v,
          vendor: v,
          isVendorPromo: true, 
          slotsLeft: slotsLeft,
          createdAt: new Date(),
          image: v.banner || v.logo
        };
      }).filter(vp => {
        return vp.slotsLeft > 0;
      });
      
      let combined = [...vendorPromos, ...factorProducts, ...factorPacks, ...factorMenuPacks, ...factorMenuItems];
      
      // Inject slotsLeft into any promo that belongs to a vendor with prepaidPromo enabled
      combined = combined.map(item => {
        const itemObj = typeof item.toObject === 'function' ? item.toObject() : { ...item };
        const v = itemObj.vendorId || itemObj.vendor;
        if (v) {
           if (v.prepaidPromo && v.prepaidPromo.enabled) {
              const maxOrders = v.prepaidPromo.maxOrders || 0;
              const usedOrders = v.prepaidPromo.usedOrders || 0;
              itemObj.slotsLeft = maxOrders - usedOrders;
           }
           const { isOpen, message } = checkIsOpen(v);
           v.isOpen = isOpen;
           v.statusMessage = message;
        }
        return itemObj;
      });

      const uniqueMap = new Map();
      combined.forEach(item => {
        if (item && item._id) uniqueMap.set(item._id.toString(), item);
      });
      
      combined = Array.from(uniqueMap.values());
      combined.sort((a, b) => new Date(b.createdAt || Date.now()).getTime() - new Date(a.createdAt || Date.now()).getTime());
      return combined;
    } catch (error) {
      console.error('Error in getAllPromos:', error);
      return [];
    }
  }

  async getPacks(vendorId: string): Promise<Pack[]> {
    if (!Types.ObjectId.isValid(vendorId)) return [];
    const packs = await this.packModel
      .find({ vendorId: new Types.ObjectId(vendorId), isActive: true })
      .populate('items.itemId')
      .sort({ orderCount: -1 });
    return this.applyMarkupToPacks(packs);
  }

  async getPackPromos(): Promise<any[]> {
    // Aggressive fix: since data is currently stored in 'menupacks' and 'packs' is empty,
    // we query 'menupacks' directly to ensure this legacy endpoint also returns the correct data structure.
    const packs = await this.packModel
      .find({ isPrepaidByPlatform: true, isActive: true })
      .populate('vendorId', 'storeName logo brandColor isOnline isVisible isOpen statusMessage')
      .populate('items.itemId')
      .sort({ createdAt: -1 })
      .limit(20);
      
    if (packs.length === 0) {
      // Fallback to menupacks
      const menuPacks = await this.productModel.db.collection('menupacks')
        .find({ isPrepaidByPlatform: true, isAvailable: true })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
        
      // Manually populate vendor to match the expected data structure
      for (const p of menuPacks) {
        if (p.vendorId) {
          let vId = p.vendorId;
          if (typeof vId === 'string') {
            if (!Types.ObjectId.isValid(vId)) continue;
            vId = new Types.ObjectId(vId);
          }
          const vendor = await this.productModel.db.collection('vendors').findOne({ _id: vId });
          if (vendor) {
            p.vendorId = {
              _id: vendor._id,
              storeName: vendor.storeName,
              logo: vendor.logo,
              brandColor: vendor.brandColor,
              isOnline: vendor.isOnline,
              isVisible: vendor.isVisible
            };
          }
        }
      }
      return menuPacks;
    }
    
    return this.applyMarkupToPacks(packs);
  }

  async findByOwner(ownerId: string): Promise<Product[]> {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    return this.productModel
      .find({ vendor: vendor._id })
      .sort({ category: 1, name: 1 });
  }

  async createBulkFromCatalog(ownerId: string, items: { globalProductId: string, price: number, stockQuantity?: number }[]): Promise<Product[]> {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    
    // We will find all requested global products
    const globalIds = items.map(i => new Types.ObjectId(i.globalProductId));
    const globalProducts = await this.globalProductsService.search('', undefined, 1000); // we could optimize this to a findByIds but we can filter the result
    const globalProductsMap = new Map();
    // A more direct approach:
    const targetGlobalProducts = await (this.globalProductsService as any).globalProductModel.find({ _id: { $in: globalIds } });
    targetGlobalProducts.forEach((gp: any) => globalProductsMap.set(gp._id.toString(), gp));
    
    const productsToCreate = items.map(item => {
      const gp = globalProductsMap.get(item.globalProductId);
      if (!gp) throw new NotFoundException(`Global product ${item.globalProductId} not found`);
      
      // We map the global product fields to the local product fields
      // Default to "Uncategorized" or the vendor's default category if gp.categoryId is null, 
      // but for now we just use a string placeholder or null, since Product.category is a string here.
      return {
        vendor: vendor._id,
        globalProductId: gp._id,
        name: gp.name,
        image: gp.image,
        category: gp.categoryId ? gp.categoryId.toString() : 'General', // Product schema expects a string category
        price: item.price,
        stockQuantity: item.stockQuantity ?? -1,
        isAvailable: true
      };
    });
    
    const createdProducts = await this.productModel.insertMany(productsToCreate);
    
    // Increment adoption counts
    for (const item of items) {
      await this.globalProductsService.incrementAdoption(item.globalProductId);
    }
    
    return createdProducts;
  }

  async findById(id: string): Promise<Product> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Product not found');
    }
    const product = await this.productModel.findById(id).populate('vendor');
    if (!product) throw new NotFoundException('Product not found');
    const factor = await this.getMarkupFactor();
    return this.applyMarkupToProduct(product, factor);
  }

  async update(id: string, data: Partial<Product>): Promise<Product> {
    // Prevent overriding read-only/critical fields
    delete data._id;
    delete data.vendor;

    const product = await this.productModel.findByIdAndUpdate(id, data, { new: true });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async delete(id: string): Promise<void> {
    await this.productModel.findByIdAndDelete(id);
  }

  async toggleAvailability(id: string): Promise<Product> {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    product.isAvailable = !product.isAvailable;
    await product.save();
    return product;
  }

  async search(query: string, page = 1, limit = 20): Promise<{ products: Product[]; total: number }> {
    const filter = {
      $text: { $search: query },
      isAvailable: true,
    };
    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.productModel
        .find(filter, { score: { $meta: 'textScore' } })
        .populate('vendor', 'storeName logo isOnline')
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit),
      this.productModel.countDocuments(filter),
    ]);
    const markedProducts = await this.applyMarkupToProducts(products);
    return { products: markedProducts, total };
  }

  async getByCategory(category: string): Promise<Product[]> {
    const products = await this.productModel
      .find({ category, isAvailable: true })
      .populate('vendor', 'storeName logo isOnline')
      .sort({ rating: -1 });
    return this.applyMarkupToProducts(products);
  }

  async getPopular(limit = 10): Promise<Product[]> {
    const products = await this.productModel
      .find({ isAvailable: true })
      .populate('vendor', 'storeName logo isOnline')
      .sort({ totalOrders: -1, orderCount: -1 })
      .limit(limit);
    return this.applyMarkupToProducts(products);
  }

  async getTopPicks(vendorId: string): Promise<Product[]> {
    if (!Types.ObjectId.isValid(vendorId)) return [];
    
    const vendor = await this.vendorsService.findById(vendorId);
    if (!vendor) throw new NotFoundException('Vendor not found');
    
    const hasEnoughData = (vendor.totalOrders || 0) >= 20;
    
    let products;
    if (hasEnoughData) {
      products = await this.productModel
        .find({ vendor: new Types.ObjectId(vendorId), isAvailable: true })
        .sort({ orderCount: -1 })
        .limit(6);
    } else {
      products = await this.productModel
        .find({ vendor: new Types.ObjectId(vendorId), isAvailable: true, isPinned: true })
        .limit(6);
    }
    return this.applyMarkupToProducts(products);
  }

  // ── Product Categories (per Vendor) ──

  async createCategory(vendorId: string, data: { name: string; description?: string; image?: string }): Promise<ProductCategory> {
    return this.categoryModel.create({
      ...data,
      vendor: new Types.ObjectId(vendorId),
    });
  }

  async createCategoryForOwner(ownerId: string, data: { name: string; description?: string; image?: string }): Promise<ProductCategory> {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    return this.categoryModel.create({
      ...data,
      vendor: vendor._id,
    });
  }

  async getCategoriesByVendor(vendorId: string): Promise<ProductCategory[]> {
    if (!Types.ObjectId.isValid(vendorId)) return [];
    return this.categoryModel
      .find({ vendor: new Types.ObjectId(vendorId), isActive: true })
      .sort({ sortOrder: 1, name: 1 });
  }

  async getCategoriesByOwner(ownerId: string): Promise<ProductCategory[]> {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    return this.categoryModel
      .find({ vendor: vendor._id, isActive: true })
      .sort({ sortOrder: 1, name: 1 });
  }

  async updateCategory(id: string, data: Partial<ProductCategory>): Promise<ProductCategory> {
    const cat = await this.categoryModel.findByIdAndUpdate(id, data, { new: true });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.categoryModel.findByIdAndDelete(id);
  }
}
