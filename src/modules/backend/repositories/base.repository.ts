import { FilterQuery, Model, ClientSession, Connection, Query } from 'mongoose';
import { MONGO_DATABASE_CONNECTIONS } from '../constants';
import { InjectConnection } from '@nestjs/mongoose';
import { SortDto } from '../model/dtos/abstract/sort.dto';
import { SortDirection } from '../model/enums/sort-direction.enum';
import { isEmpty } from '../utils/object.utils';
import { PaginationDto } from '../model/dtos/abstract/pagination.dto';

const CONFLICT_TRANSACTION_ERROR_CODE = 112;
const CONFLICT_TRANSACTION_ERROR_NAME = 'WriteConflict';
export abstract class BaseRepository<T> {
  @InjectConnection(MONGO_DATABASE_CONNECTIONS.P2P) protected readonly connection: Connection;

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

  async findOne(filter: FilterQuery<T>, session?: ClientSession): Promise<T | null> {
    return this.model.findOne(filter).session(session).exec();
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

  protected applySort(
    query: Query<T[], T>,
    sort: SortDto = { direction: SortDirection.DESC },
    defaultSortField: string = 'createdAt',
  ): Query<T[], T> {
    if (!sort || isEmpty(sort)) {
      sort = { direction: SortDirection.DESC };
    }
    const sortField = sort.field || defaultSortField;
    const sortOrder = sort.direction === SortDirection.ASC ? 1 : -1;
    return query.sort({ [sortField]: sortOrder } as any);
  }

  protected applyPagination(query: Query<T[], T>, pagination?: PaginationDto): Query<T[], T> {
    if (!pagination || isEmpty(pagination)) {
      pagination = { limit: 10, offset: 0 };
    }

    query = query.skip(pagination.offset);
    query = query.limit(pagination.limit);
    return query;
  }
}
