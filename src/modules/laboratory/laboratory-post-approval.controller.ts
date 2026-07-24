import {
  Body,
  Controller,
  Get,
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
    @Body() dto: SetLaboratoryOperatingHoursDto,
  ) {
    return this.postApprovalService.setOperatingHours(user.id, dto);
  }

  @Get('operating-hours')
  @LaboratoryPostApprovalAccess()
  @ListLaboratoryOperatingHoursDocs()
  listOperatingHours(@CurrentUser() user: IAuthUser) {
    return this.postApprovalService.listOperatingHours(user.id);
  }

  @Post('tests')
  @LaboratoryPostApprovalAccess()
  @HttpCode(HttpStatus.CREATED)
  @CreateLaboratoryTestDocs()
  createTest(
    @CurrentUser() user: IAuthUser,
    @Body() dto: CreateLaboratoryTestDto,
  ) {
    return this.postApprovalService.createTest(user.id, dto);
  }

  @Get('tests')
  @LaboratoryPostApprovalAccess()
  @ListLaboratoryTestsDocs()
  listTests(@CurrentUser() user: IAuthUser) {
    return this.postApprovalService.listTests(user.id);
  }

  @Patch('tests/:testId')
  @LaboratoryPostApprovalAccess()
  @UpdateLaboratoryTestDocs()
  updateTest(
    @CurrentUser() user: IAuthUser,
    @Param('testId', ParseUUIDPipe) testId: string,
    @Body() dto: UpdateLaboratoryTestDto,
  ) {
    return this.postApprovalService.updateTest(user.id, testId, dto);
  }

  @Post('staff/invitations')
  @LaboratoryPostApprovalAccess()
  @HttpCode(HttpStatus.CREATED)
  @InviteLaboratoryStaffDocs()
  inviteStaff(
    @CurrentUser() user: IAuthUser,
    @Body() dto: InviteLaboratoryStaffDto,
  ) {
    return this.postApprovalService.inviteStaff(user.id, dto);
  }

  @Get('staff')
  @LaboratoryPostApprovalAccess()
  @ListLaboratoryStaffDocs()
  listStaff(@CurrentUser() user: IAuthUser) {
    return this.postApprovalService.listStaff(user.id);
  }

  @Post('staff/invitations/accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  @AcceptLaboratoryStaffInvitationDocs()
  acceptStaffInvitation(@Body() dto: AcceptLaboratoryStaffInvitationDto) {
    return this.postApprovalService.acceptStaffInvitation(dto);
  }
}
