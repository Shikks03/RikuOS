import mongoose, { Document, Model, Schema } from "mongoose";
// Relative and with the extension, not "@/": sync-indexes.mts loads this model
// under `node --experimental-strip-types`, which resolves no tsconfig alias.
// personalLayout.ts imports nothing, so it is safe on that import graph.
import { PERSONAL_LAYOUT_DEFAULT, PERSONAL_TILES } from "../lib/personalLayout.ts";
import type { LayoutEntry, PersonalLayout } from "../lib/personalLayout.ts";

/**
 * One chosen Google calendar. `calendarId` is Google's id, `name` the label the
 * page shows, `enabled` whether its events are read. Membership order IS
 * display order. Declared here (not in lib/) because the schema below needs it
 * and a model must not import from lib/osSettings.ts, which imports the model;
 * osSettings.ts re-exports it for google.ts and the page.
 */
export interface Layer {
  calendarId: string;
  name: string;
  enabled: boolean;
}

/** Deck 9's bound: at most ten layers. */
export const LAYERS_MAX = 10;
export const LAYER_CALENDAR_ID_MAX = 256;
export const LAYER_NAME_MAX = 120;
const LAYOUT_ROWS = 4;

export interface IOsSettings extends Document {
  chaserEnabled: boolean;
  chaserNDays: number;
  monitoringEnabled: boolean;
  layers: Layer[];
  personalLayout: PersonalLayout;
  updatedAt: Date;
}

/**
 * The defaults, in one place. The schema reads them below, and
 * readOsSettings() returns them for any value the document does not carry,
 * including when there is no document yet — so the value a read reports is
 * exactly the value the upsert would have written. Two copies is how those two
 * drift apart (R37, R41).
 */
export const OS_SETTINGS_DEFAULTS: Readonly<{
  chaserEnabled: boolean;
  chaserNDays: number;
  monitoringEnabled: boolean;
  /** No calendar chosen until Riku picks one. */
  layers: readonly Readonly<Layer>[];
  /**
   * `readonly` all the way down. The arrays are shared by every caller for the
   * life of the lambda, so readOsSettings() COPIES them on read (R35), and
   * the schema default below copies them per document.
   */
  personalLayout: ReadonlyArray<ReadonlyArray<Readonly<LayoutEntry>>>;
}> = {
  chaserEnabled: false,
  chaserNDays: 4,
  monitoringEnabled: false,
  layers: [],
  personalLayout: PERSONAL_LAYOUT_DEFAULT,
};

/** A fresh, fully mutable copy of the default layout: new rows, new entries. */
export function copyDefaultLayout(): PersonalLayout {
  return OS_SETTINGS_DEFAULTS.personalLayout.map((row) =>
    row.map((e) => ({ tile: e.tile, span: e.span }))
  );
}

const LayerSchema = new Schema<Layer>(
  {
    calendarId: { type: String, required: true, maxlength: LAYER_CALENDAR_ID_MAX },
    name: { type: String, required: true, maxlength: LAYER_NAME_MAX },
    enabled: { type: Boolean, required: true, default: true }, // deck: on when first chosen
  },
  { _id: false }
);

const LayoutEntrySchema = new Schema<LayoutEntry>(
  {
    tile: { type: String, required: true, enum: PERSONAL_TILES },
    span: { type: Number, required: true, min: 2, max: 12 },
  },
  { _id: false }
);

/**
 * Singleton: exactly one document ever exists. It is created and written only
 * through the upsert accessor in src/lib/osSettings.ts (CLAUDE.md singleton
 * rule); hot read paths use readOsSettings(), which never upserts and falls
 * back to OS_SETTINGS_DEFAULTS.
 *
 * P3 carries only the chaser fields (ARCHITECTURE.md §3.1 names them
 * explicitly); each later agent adds its own toggle when it ships. Defaults
 * are off so deploying an agent never silently activates it.
 *
 * P10b adds the Personal page's two stores, both typed and bounded — no Mixed:
 * `layers` (≤ 10) and `personalLayout` (exactly four rows of {tile, span}).
 * The schema pins shape and per-entry bounds only; the layout's cross-entry
 * rules (each tile once, rows ≤ 12 columns) are validateLayout()'s, called by
 * parseSettingsPatch on write, and resolvePersonalLayout() is total on read.
 * Measured: `doc.validate()` reaches the layout's entries, the deprecated
 * `validateSync()` does not (an array of document arrays), so
 * parseSettingsPatch is the enforcer that must never be bypassed.
 */
const OsSettingsSchema = new Schema<IOsSettings>(
  {
    chaserEnabled: { type: Boolean, required: true, default: OS_SETTINGS_DEFAULTS.chaserEnabled },
    chaserNDays: {
      type: Number,
      required: true,
      default: OS_SETTINGS_DEFAULTS.chaserNDays,
      min: 1,
      max: 30,
    },
    monitoringEnabled: {
      type: Boolean,
      required: true,
      default: OS_SETTINGS_DEFAULTS.monitoringEnabled,
    },
    layers: {
      type: [LayerSchema],
      default: () => [],
      validate: {
        validator: (v: unknown[]) => v.length <= LAYERS_MAX,
        message: `At most ${LAYERS_MAX} layers.`,
      },
    },
    personalLayout: {
      type: [[LayoutEntrySchema]],
      default: copyDefaultLayout,
      validate: {
        validator: (v: unknown[]) => v.length === LAYOUT_ROWS,
        message: `A layout has exactly ${LAYOUT_ROWS} rows.`,
      },
    },
  },
  { timestamps: { createdAt: false, updatedAt: true }, strict: true }
);

const OsSettings =
  (mongoose.models.OsSettings as Model<IOsSettings>) ||
  mongoose.model<IOsSettings>("OsSettings", OsSettingsSchema);

export default OsSettings;
