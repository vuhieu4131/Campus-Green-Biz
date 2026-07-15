export interface PercentSale {
  type: "percent";
  percent: number;
}

export interface FixedSale {
  amount: number;
  type: "fixed";
}

export type Sale = PercentSale | FixedSale;

export interface Option {
  id: string;
  label?: string;
  priceChange?: Sale;
}

export interface BaseVariant {
  id: string;
  label?: string;
  options: Option[];
}

export interface SingleOptionVariant extends BaseVariant {
  type: "single";
  default?: string;
}

export interface MultipleOptionVariant extends BaseVariant {
  type: "multiple";
  default?: string[];
}

export type Variant = SingleOptionVariant | MultipleOptionVariant;

export interface Product {
  id: any;
  name: string;
  image: string;
  price: number;
  categoryId: string[];
  description?: string;
  sale?: Sale;
  variants?: Variant[];
  title?: string;
  shopName?: string;
  locationAddress?: string;
  points?: number;
  originalPrice?: number;
  discountPercent?: number;
  attributes?: any[];
  status?: string;
  hidePrice?: boolean;
  stars?: number;
  hasVariants?: boolean;
  ownerPhone?: string;
  providerId?: string;
  createdAt?: any;
}
