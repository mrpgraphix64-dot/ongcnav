import {
  Controller,
  Get,
  Post,
  Delete,
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMMERCIAL_ADMIN)
  @ApiOperation({ summary: 'Admin audit list of commercial transactions and payments' })
  async listOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('source') source?: string,
    @Query('agentId') agentId?: string,
    @Query('ticketType') ticketType?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('groupBy') groupBy?: string,
    @Req() req?: Request,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    const user = req ? (req as any).user : undefined;
    return this.commercialService.listOrdersAdmin({
      page: p,
      limit: l,
      source,
      agentId,
      ticketType,
      status,
      search,
      date,
      groupBy,
      userRole: user?.role,
    });
  }

  @Post('orders/bulk-delete')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMMERCIAL_ADMIN)
  @ApiOperation({ summary: 'Bulk delete commercial orders with strict dependency and financial protections' })
  async bulkDeleteOrders(@Body() body: { orderIds: string[] }, @Req() req?: Request) {
    const user = req ? (req as any).user : undefined;
    return this.commercialService.bulkDeleteOrdersAdmin(body?.orderIds || [], user);
  }

  @Delete('orders/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMMERCIAL_ADMIN)
  @ApiOperation({ summary: 'Delete a single commercial order with strict financial protections' })
  async deleteOrder(@Param('id') id: string, @Req() req?: Request) {
    const user = req ? (req as any).user : undefined;
    return this.commercialService.deleteOrderAdmin(BigInt(id), user);
  }
}
