import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CommercialService } from './commercial.service';
import { CreateCommercialOrderDto } from './dto/create-commercial-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { ResendTicketEmailDto } from './dto/resend-ticket-email.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@ongc/shared-types';

@ApiTags('Commercial Passes & Ticketing')
@Controller('commercial')
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get public commercial pass configuration, dates, pricing, and public Razorpay key' })
  async getConfig() {
    return this.commercialService.getConfig();
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create a new pending commercial order and Razorpay order' })
  async createOrder(
    @Body() body: CreateCommercialOrderDto,
    @Req() req: Request,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.commercialService.createOrder(body, clientIp);
  }

  @Post('orders/verify')
  @ApiOperation({ summary: 'Verify Razorpay payment signature and issue entry pass' })
  async verifyPayment(@Body() body: VerifyPaymentDto) {
    return this.commercialService.verifyPayment(body);
  }

  @Get('orders/:orderNumber')
  @ApiOperation({ summary: 'Get order details, payment status, and passes by order number' })
  async getOrder(
    @Param('orderNumber') orderNumber: string,
    @Query('mobile') mobile?: string,
  ) {
    return this.commercialService.getOrder(orderNumber, mobile);
  }

  @Post('orders/:orderNumber/email')
  @ApiOperation({ summary: 'Email commercial entry passes to registered customer email' })
  async resendTicketEmail(
    @Param('orderNumber') orderNumber: string,
    @Body() body: ResendTicketEmailDto,
    @Req() req: Request,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.commercialService.resendTicketEmail(orderNumber, body.mobile, clientIp);
  }
}

@ApiTags('Admin Commercial Audit')
@Controller('admin/commercial')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CommercialAdminController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get('orders')
  @Roles(UserRole.SUPER_ADMIN, UserRole.EVENT_ADMIN, UserRole.ADMIN, UserRole.REPORT_VIEWER)
  @ApiOperation({ summary: 'Admin audit list of commercial transactions and payments' })
  async listOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    return this.commercialService.listOrdersAdmin(p, l);
  }
}
