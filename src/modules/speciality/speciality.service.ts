import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import * as sysMsg from '../../constants/system.messages';
import { PublicSearchQueryDto } from '../public-discovery/dto/public-discovery-query.dto';
import {
  PublicSpecialityCatalogueDto,
  PublicSpecialityDto,
} from '../public-discovery/dto/public-discovery-response.dto';
import { PublicDiscoveryVisibilityPolicy } from '../public-discovery/public-discovery-visibility.policy';
import { PublicResourceNotFoundException } from '../public-discovery/public-discovery.errors';
import {
  toPublicPaginationMeta,
  toPublicSpeciality,
} from '../public-discovery/public-discovery.mapper';
import { toPublicSearchPattern } from '../public-discovery/public-discovery.search';

import { CreateSpecialityDto } from './dto/create-speciality.dto';
import { SpecialityResponseDto } from './dto/speciality-response.dto';
import { UpdateSpecialityDto } from './dto/update-speciality.dto';
import { Speciality } from './entities/speciality.entity';

@Injectable()
export class SpecialityService {
  constructor(
    @InjectRepository(Speciality)
    private readonly specialityRepository: Repository<Speciality>,
    private readonly publicVisibility: PublicDiscoveryVisibilityPolicy,
  ) {}

  /**
   * Public catalogue page: visible specialities only, ordered by name without
   * regard to case and then by identifier so paging is deterministic.
   */
  async findPublicCatalogue(
    query: PublicSearchQueryDto,
  ): Promise<PublicSpecialityCatalogueDto> {
    const catalogue = this.createPublicCatalogueQuery();

    if (query.q) {
      catalogue.andWhere("speciality.name ILIKE :publicSearch ESCAPE '\\'", {
        publicSearch: toPublicSearchPattern(query.q),
      });
    }

    const [specialities, total] = await catalogue
      .orderBy('LOWER(speciality.name)', 'ASC')
      .addOrderBy('speciality.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      items: specialities.map(toPublicSpeciality),
      meta: toPublicPaginationMeta(query.page, query.limit, total),
    };
  }

  /** One visible speciality, or the single public not-found outcome. */
  async findPublicById(id: string): Promise<PublicSpecialityDto> {
    const speciality = await this.createPublicCatalogueQuery()
      .andWhere('speciality.id = :id', { id })
      .getOne();
    if (!speciality) throw new PublicResourceNotFoundException();
    return toPublicSpeciality(speciality);
  }

  async findAll(): Promise<SpecialityResponseDto[]> {
    const specialities = await this.specialityRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
    return specialities.map(this.toDto);
  }

  async findById(id: string): Promise<SpecialityResponseDto> {
    const speciality = await this.specialityRepository.findOne({
      where: { id },
    });
    if (!speciality) throw new NotFoundException(sysMsg.SPECIALITY_NOT_FOUND);
    return this.toDto(speciality);
  }

  async create(dto: CreateSpecialityDto): Promise<SpecialityResponseDto> {
    const exists = await this.specialityRepository.findOne({
      where: { name: dto.name },
    });
    if (exists) throw new ConflictException(sysMsg.SPECIALITY_ALREADY_EXISTS);

    const speciality = this.specialityRepository.create(dto);
    const saved = await this.specialityRepository.save(speciality);
    return this.toDto(saved);
  }

  async update(
    id: string,
    dto: UpdateSpecialityDto,
  ): Promise<SpecialityResponseDto> {
    const speciality = await this.specialityRepository.findOne({
      where: { id },
    });
    if (!speciality) throw new NotFoundException(sysMsg.SPECIALITY_NOT_FOUND);

    // Unique name check when name is being changed
    if (dto.name && dto.name !== speciality.name) {
      const nameConflict = await this.specialityRepository.findOne({
        where: { name: dto.name },
      });
      if (nameConflict)
        throw new ConflictException(sysMsg.SPECIALITY_ALREADY_EXISTS);
    }

    Object.assign(speciality, dto);
    const saved = await this.specialityRepository.save(speciality);
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<Speciality> {
    const speciality = await this.specialityRepository.findOne({
      where: { id, is_active: true },
    });
    if (!speciality) throw new NotFoundException(sysMsg.SPECIALITY_NOT_FOUND);
    return speciality;
  }

  private createPublicCatalogueQuery(): SelectQueryBuilder<Speciality> {
    return this.publicVisibility.applySpecialityVisibility(
      this.specialityRepository
        .createQueryBuilder('speciality')
        .select([
          'speciality.id',
          'speciality.name',
          'speciality.description',
          'speciality.icon',
        ]),
      'speciality',
    );
  }

  private toDto(speciality: Speciality): SpecialityResponseDto {
    return {
      id: speciality.id,
      name: speciality.name,
      description: speciality.description,
      icon: speciality.icon,
      is_active: speciality.is_active,
      created_at: speciality.created_at,
      updated_at: speciality.updated_at,
    };
  }
}
