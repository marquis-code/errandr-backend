import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department } from './schemas/department.schema';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name) private departmentModel: Model<Department>,
  ) {}

  async create(data: Partial<Department>): Promise<Department> {
    const existing = await this.departmentModel.findOne({ name: data.name });
    if (existing) {
      throw new ConflictException('Department with this name already exists');
    }
    const newDepartment = new this.departmentModel(data);
    return newDepartment.save();
  }

  async findAll(): Promise<Department[]> {
    return this.departmentModel.find().exec();
  }

  async findOne(id: string): Promise<Department> {
    const dept = await this.departmentModel.findById(id).exec();
    if (!dept) {
      throw new NotFoundException('Department not found');
    }
    return dept;
  }

  async update(id: string, data: Partial<Department>): Promise<Department> {
    const dept = await this.departmentModel.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!dept) {
      throw new NotFoundException('Department not found');
    }
    return dept;
  }

  async remove(id: string): Promise<any> {
    const dept = await this.departmentModel.findByIdAndDelete(id).exec();
    if (!dept) {
      throw new NotFoundException('Department not found');
    }
    return { success: true, message: 'Department deleted successfully' };
  }
}
