import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

const PushSubscriptionKeysSchema = new Schema<IPushSubscriptionKeys>(
  {
    p256dh: { type: String, required: true, maxlength: 256 },
    auth: { type: String, required: true, maxlength: 256 },
  },
  { _id: false, strict: true }
);

export interface IPushSubscription extends Document {
  endpoint: string;
  keys: IPushSubscriptionKeys;
  createdAt: Date;
}

/**
 * One doc per subscribed device (multiple devices allowed — ARCHITECTURE.md
 * §3.1). endpoint is required, so a plain unique index is safe here (the
 * partial-index rule applies to nullable uniques only).
 */
const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    endpoint: { type: String, required: true, maxlength: 1024, unique: true },
    keys: { type: PushSubscriptionKeysSchema, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true }
);

const PushSubscription =
  (mongoose.models.PushSubscription as Model<IPushSubscription>) ||
  mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);

export default PushSubscription;
