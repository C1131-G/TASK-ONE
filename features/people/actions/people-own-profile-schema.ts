import { Schema } from "effect";

export const OwnProfileResultSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
