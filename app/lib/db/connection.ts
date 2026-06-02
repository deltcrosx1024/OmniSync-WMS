import mongoose from "mongoose";

declare global {
  var _mongoClientPromise: Promise<typeof mongoose> | undefined;
  var _mongoClient: typeof mongoose | undefined;
}

const cached: {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
} = {
  conn: global._mongoClient ?? null,
  promise: global._mongoClientPromise ?? null,
};

async function createConnection(mongoUri: string) {
  return mongoose.connect(mongoUri).then((client) => {
    cached.conn = client;
    return client;
  });
}

export async function connectToMongo() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGO_URI) {
    throw new Error("Missing MongoDB connection string. Set MONGODB_URI or MONGO_URI.");
  }

  if (!cached.promise) {
    cached.promise = createConnection(MONGO_URI);
    global._mongoClientPromise = cached.promise;
    global._mongoClient = cached.conn as typeof mongoose;
  }

  return (await cached.promise) as typeof mongoose;
}
