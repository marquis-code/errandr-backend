import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from './schemas/product.schema';
import { ProductCategory } from './schemas/product-category.schema';
import { Pack } from './schemas/pack.schema';
import { VendorsService } from '../vendors/vendors.service';
import { GlobalProductsService } from '../global-products/global-products.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(ProductCategory.name) private categoryModel: Model<ProductCategory>,
    @InjectModel(Pack.name) private packModel: Model<Pack>,
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

  async findByVendor(vendorId: string): Promise<Product[]> {
    if (!Types.ObjectId.isValid(vendorId)) {
      return [];
    }
    return this.productModel
      .find({ vendor: new Types.ObjectId(vendorId) })
      .sort({ category: 1, name: 1 });
  }


  async getPacks(vendorId: string): Promise<Pack[]> {
    if (!Types.ObjectId.isValid(vendorId)) return [];
    return this.packModel
      .find({ vendorId: new Types.ObjectId(vendorId), isActive: true })
      .populate('items.itemId')
      .sort({ orderCount: -1 });
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
    const product = await this.productModel.findById(id).populate('vendor');
    if (!product) throw new NotFoundException('Product not found');
    return product;
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
    return { products, total };
  }

  async getByCategory(category: string): Promise<Product[]> {
    return this.productModel
      .find({ category, isAvailable: true })
      .populate('vendor', 'storeName logo isOnline')
      .sort({ rating: -1 });
  }

  async getPopular(limit = 10): Promise<Product[]> {
    return this.productModel
      .find({ isAvailable: true })
      .populate('vendor', 'storeName logo isOnline')
      .sort({ totalOrders: -1, orderCount: -1 })
      .limit(limit);
  }

  async getTopPicks(vendorId: string): Promise<Product[]> {
    if (!Types.ObjectId.isValid(vendorId)) return [];
    
    const vendor = await this.vendorsService.findById(vendorId);
    if (!vendor) throw new NotFoundException('Vendor not found');
    
    const hasEnoughData = (vendor.totalOrders || 0) >= 20;
    
    if (hasEnoughData) {
      return this.productModel
        .find({ vendor: new Types.ObjectId(vendorId), isAvailable: true })
        .sort({ orderCount: -1 })
        .limit(6);
    } else {
      return this.productModel
        .find({ vendor: new Types.ObjectId(vendorId), isAvailable: true, isPinned: true })
        .limit(6);
    }
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
