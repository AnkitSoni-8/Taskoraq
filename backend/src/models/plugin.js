// Keeps the frontend's string `id` field and hides Mongo internals in JSON output.
export function cleanJSON(schema) {
  schema.set("toJSON", {
    versionKey: false,
    transform: (_doc, ret) => {
      delete ret._id;
      return ret;
    },
  });
}
