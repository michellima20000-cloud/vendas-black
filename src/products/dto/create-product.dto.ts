import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { OptionalText } from '../../common/decorators/optional-text.decorator';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @Length(1, 160)
  name: string;

  @ApiPropertyOptional()
  @OptionalText(1, 5000)
  description?: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  comparePrice?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  @IsOptional()
  installments?: number;

  @ApiPropertyOptional()
  @OptionalText(1, 64)
  categoryId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
