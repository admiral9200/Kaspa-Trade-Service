import {  Model } from 'mongoose';

export abstract class BaseRepository<T> {
  protected constructor(
    private readonly model: Model<T>,
  ) {}

  private get modelName(): string {
    return this.constructor.name;
  }

  async create(data: T): Promise<T> {
    return this.model.create(data);
  }
  
  async count(): Promise<number> {
    return this.model.estimatedDocumentCount();
  }

  async findOneBy(field: keyof T, value: any): Promise<T | null> {
    return await this.model.findOne({ [field]: value } as any).exec();
  }
}
