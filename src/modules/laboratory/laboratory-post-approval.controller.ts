import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { IAuthUser } from '../../common/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { LaboratoryPostApprovalAccess } from './decorators/laboratory-post-approval-access.decorator';
import {
  AcceptLaboratoryStaffInvitationDocs,
  CreateLaboratoryTestDocs,
  InviteLaboratoryStaffDocs,
  ListLaboratoryOperatingHoursDocs,
  ListLaboratoryStaffDocs,
  ListLaboratoryTestsDocs,
  SetLaboratoryOperatingHoursDocs,
  UpdateLaboratoryTestDocs,
} from './docs/post-approval-setup.doc';
import {
  AcceptLaboratoryStaffInvitationDto,
  CreateLaboratoryTestDto,
  InviteLaboratoryStaffDto,
  SetLaboratoryOperatingHoursDto,
  UpdateLaboratoryTestDto,
} from './dto/laboratory-post-approval.dto';
import { LaboratoryPostApprovalService } from './laboratory-post-approval.service';

@ApiTags('Laboratory Post-Approval Setup')
@Controller('laboratories/setup')
export class LaboratoryPostApprovalController {
  constructor(
    private readonly postApprovalService: LaboratoryPostApprovalService,
  ) {}

  @Put('operating-hours')
  @LaboratoryPostApprovalAccess()
  @SetLaboratoryOperatingHoursDocs()
  setOperatingHours(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: SetLaboratoryOperatingHoursDto,
  ) {
    return this.postApprovalService.setOperatingHours(
      user.id,
      organizationId,
      dto,
    );
  }

  @Get('operating-hours')
  @LaboratoryPostApprovalAccess()
  @ListLaboratoryOperatingHoursDocs()
  listOperatingHours(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.postApprovalService.listOperatingHours(user.id, organizationId);
  }

  @Post('tests')
  @LaboratoryPostApprovalAccess()
  @HttpCode(HttpStatus.CREATED)
  @CreateLaboratoryTestDocs()
  createTest(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: CreateLaboratoryTestDto,
  ) {
    return this.postApprovalService.createTest(user.id, organizationId, dto);
  }

  @Get('tests')
  @LaboratoryPostApprovalAccess()
  @ListLaboratoryTestsDocs()
  listTests(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.postApprovalService.listTests(user.id, organizationId);
  }

  @Patch('tests/:testId')
  @LaboratoryPostApprovalAccess()
  @UpdateLaboratoryTestDocs()
  updateTest(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
    @Param('testId', ParseUUIDPipe) testId: string,
    @Body() dto: UpdateLaboratoryTestDto,
  ) {
    return this.postApprovalService.updateTest(
      user.id,
      organizationId,
      testId,
      dto,
    );
  }

  @Post('staff/invitations')
  @LaboratoryPostApprovalAccess()
  @HttpCode(HttpStatus.CREATED)
  @InviteLaboratoryStaffDocs()
  inviteStaff(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: InviteLaboratoryStaffDto,
  ) {
    return this.postApprovalService.inviteStaff(user.id, organizationId, dto);
  }

  @Get('staff')
  @LaboratoryPostApprovalAccess()
  @ListLaboratoryStaffDocs()
  listStaff(
    @CurrentUser() user: IAuthUser,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.postApprovalService.listStaff(user.id, organizationId);
  }

  @Post('staff/invitations/accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  @AcceptLaboratoryStaffInvitationDocs()
  acceptStaffInvitation(@Body() dto: AcceptLaboratoryStaffInvitationDto) {
    return this.postApprovalService.acceptStaffInvitation(dto);
  }
}
