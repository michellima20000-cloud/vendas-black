import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { OptionalText } from '../../common/decorators/optional-text.decorator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Colares' })
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiPropertyOptional({ example: 'colares' })
  @OptionalText(1, 80)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens',
  })
  slug?: string;
}
