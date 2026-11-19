import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class OrderItemDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  productId: string;

  @ApiProperty({ minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  variation?: string;
}

export class OrderAddressDto {
  @ApiProperty()
  @IsString()
  @Length(1, 160)
  street: string;

  @ApiProperty()
  @IsString()
  @Length(1, 20)
  number: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  complement?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  district: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  city: string;

  @ApiProperty()
  @IsString()
  @Length(2, 2)
  state: string;

  @ApiProperty()
  @IsString()
  @Length(8, 9)
  zipCode: string;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  storeSlug: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 64)
  couponCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: `paymentMethod must be one of: ${Object.values(PaymentMethod).join(', ')}`,
  })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ type: OrderAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderAddressDto)
  address?: OrderAddressDto;
}
