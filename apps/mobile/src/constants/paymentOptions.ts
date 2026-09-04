import type { PaymentMethod } from "@tbc/shared-types";

export interface PaymentOption {
  id: string;
  label: string;
  /** Every UPI/card/net-banking option funnels into the same "razorpay" order-level
   * payment method — the actual Razorpay Checkout UI is where the customer picks
   * their specific app/bank (see utils/razorpayCheckout.ts). */
  apiMethod: PaymentMethod;
}

export interface PaymentOptionGroup {
  title: string;
  options: PaymentOption[];
}

export const PAYMENT_OPTION_GROUPS: PaymentOptionGroup[] = [
  {
    title: "UPI",
    options: [
      { id: "gpay", label: "Google Pay", apiMethod: "razorpay" },
      { id: "phonepe", label: "PhonePe", apiMethod: "razorpay" },
      { id: "paytm", label: "Paytm", apiMethod: "razorpay" },
      { id: "upi-other", label: "Other UPI apps", apiMethod: "razorpay" },
    ],
  },
  {
    title: "Cards",
    options: [
      { id: "debit", label: "Debit Card", apiMethod: "razorpay" },
      { id: "credit", label: "Credit Card", apiMethod: "razorpay" },
    ],
  },
  {
    title: "Net Banking",
    options: [{ id: "netbanking", label: "Net Banking", apiMethod: "razorpay" }],
  },
  {
    title: "Cash",
    options: [{ id: "cod", label: "Cash on Delivery", apiMethod: "cod" }],
  },
];
