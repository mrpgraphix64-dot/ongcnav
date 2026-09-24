import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({ example: 'ORD-COMM-20261011-A1B2C3', description: 'Internal order reference number' })
  @IsString()
  @IsNotEmpty({ message: 'Order reference number is required.' })
  @MaxLength(100)
  orderNumber: string;

  @ApiProperty({ example: 'order_EKwxwAgIt4iVDv', description: 'Razorpay order ID returned during checkout' })
  @IsString()
  @IsNotEmpty({ message: 'Razorpay order ID is required.' })
  @MaxLength(100)
  razorpayOrderId: string;

  @ApiProperty({ example: 'pay_29QQoUBi66xm2f', description: 'Razorpay payment ID returned after payment' })
  @IsString()
  @IsNotEmpty({ message: 'Razorpay payment ID is required.' })
  @MaxLength(100)
  razorpayPaymentId: string;

  @ApiProperty({ example: '9ef4b41b8a5d3f28d8b9d88f6c449...', description: 'Razorpay cryptographic HMAC-SHA256 signature' })
  @IsString()
  @IsNotEmpty({ message: 'Razorpay signature is required.' })
  @MaxLength(255)
  razorpaySignature: string;
}
