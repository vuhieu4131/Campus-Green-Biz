export interface User {
    zaloId: string;
    fullName: string;
    role: 'customer' | 'vendor_admin' | 'super_admin';
    tier: 'member' | 'silver' | 'gold' | 'diamond';
    totalPoints: number;
    createdAt: string | Date | any;
}

export interface OrderItem {
    productId: string;
    productName: string;
    quantity: number;
    priceAtPurchase: number;
    subtotal: number;
}

export interface Order {
    orderCode: string;
    customer: {
        userId: string;
        fullName: string;
    };
    vendor: {
        vendorId: string;
        name: string;
    };
    items: OrderItem[];
    totalAmount: number;
    paymentInfo: {
        method: string;
        status: 'pending_payment' | 'paid' | 'failed';
        qrCodeContent?: string;
    };
    accountingSplit?: {
        platformCommission: number;
        vendorReceivable: number;
        taxAmount: number;
    };
    createdAt: any;
}

export interface Vendor {
    name: string;
    adminIds: string[];
    financialConfig: {
        bankCode: string;
        accountNumber: string;
        accountName: string;
        revenueShareRate?: number;
    };
}
