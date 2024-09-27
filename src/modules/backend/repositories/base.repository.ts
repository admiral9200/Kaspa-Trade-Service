import { FilterQuery, Model, ClientSession } from 'mongoose';

const CONFLICT_TRANSACTION_ERROR_CODE = 112;
const CONFLICT_TRANSACTION_ERROR_NAME = 'WriteConflict';
export abstract class BaseRepository<T> {
  protected constructor(private readonly model: Model<T>) {}

  private get modelName(): string {
    return this.constructor.name;
  }

  async create(data: T, session?: ClientSession): Promise<T> {
    return this.model.create([data], { session }).then((docs) => docs[0]);
  }

  async count(session?: ClientSession): Promise<number> {
    return this.model.estimatedDocumentCount().session(session);
  }

  async findOneBy(field: keyof T, value: any, session?: ClientSession): Promise<T | null> {
    return await this.model
      .findOne({ [field]: value } as any)
      .session(session)
      .exec();
  }

  async updateByOne(
    field: keyof T,
    value: any,
    data: Partial<T>,
    additionalCriteria: FilterQuery<T> = {},
    session?: ClientSession,
  ): Promise<T | null> {
    const filter: FilterQuery<T> = {
      [field]: value,
      ...additionalCriteria,
    };

    return await this.model.findOneAndUpdate(filter, { $set: data }, { new: true }).session(session).exec();
  }

  isDocumentTransactionLockedError(error): boolean {
    return error?.code === CONFLICT_TRANSACTION_ERROR_CODE && error?.codeName === CONFLICT_TRANSACTION_ERROR_NAME;
  }
}
