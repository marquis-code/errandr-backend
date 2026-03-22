import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from './schemas/product.schema';
import { ProductCategory } from './schemas/product-category.schema';
import { VendorsService } from '../vendors/vendors.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(ProductCategory.name) private categoryModel: Model<ProductCategory>,
    private vendorsService: VendorsService,
  ) {}

  // ── Products ──

  async create(vendorId: string, data: Partial<Product>): Promise<Product> {
    if (!Types.ObjectId.isValid(vendorId)) {
      throw new NotFoundException('Invalid vendor ID');
    }
    return this.productModel.create({
      ...data,
      vendor: new Types.ObjectId(vendorId),
    });
  }

  async createForOwner(ownerId: string, data: Partial<Product>): Promise<Product> {
    const vendor = await this.vendorsService.findByOwner(ownerId);
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

  async findByOwner(ownerId: string): Promise<Product[]> {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    return this.productModel
      .find({ vendor: vendor._id })
      .sort({ category: 1, name: 1 });
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productModel.findById(id).populate('vendor');
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, data: Partial<Product>): Promise<Product> {
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
      .sort({ totalOrders: -1 })
      .limit(limit);
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
