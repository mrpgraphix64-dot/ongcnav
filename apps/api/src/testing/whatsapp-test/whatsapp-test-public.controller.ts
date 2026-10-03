import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WhatsAppTestService } from './whatsapp-test.service';
import {
  SubmitWhatsAppTestPassDto,
  SendWhatsAppTestMessageDto,
  VerifyWhatsAppTestDto,
} from './whatsapp-test.dto';

@ApiTags('Public - WhatsApp Test Registration')
@Controller('public/whatsapp-test')
export class WhatsAppTestPublicController {
  constructor(private readonly testService: WhatsAppTestService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Get public WhatsApp test configuration (sanitized, zero secrets)',
  })
  async getConfig() {
    return this.testService.getConfig();
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify CPF and mobile number for public WhatsApp test registration',
  })
  async verifyEmployee(@Body() dto: VerifyWhatsAppTestDto) {
    return this.testService.verifyEmployee(dto.cpf, dto.mobile);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit isolated public WhatsApp test registration and generate test pass',
  })
  async submitTestPass(@Body() dto: SubmitWhatsAppTestPassDto) {
    return this.testService.submitTestPass(dto, 'PUBLIC_TEST_USER');
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Send WhatsApp test pass message strictly to configured Super Admin safe test recipient',
  })
  async sendTestMessage(@Body() dto: SendWhatsAppTestMessageDto) {
    return this.testService.sendTestMessage(dto, 'PUBLIC_TEST_USER');
  }
}
