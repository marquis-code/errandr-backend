import { IsNumber, IsString, IsNotEmpty, Min, IsOptional } from 'class-validator';

export class FundWalletDto {
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}
