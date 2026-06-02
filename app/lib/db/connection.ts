import mongoose, { ConnectOptions, Connection } from "mongoose";

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

async function createConnection(mongoUri: string, defaultDb?: string) {
  const options: ConnectOptions = {
    autoIndex: true,
    maxPoolSize: 10,
  };

  if (!process.env.MONGODB_URI && defaultDb) {
    options.dbName = defaultDb;
  }

  return mongoose.connect(mongoUri, options).then((client) => {
    cached.conn = client;
    return client;
  });
}

function buildMongoUri(): string | null {
  const publicKey = process.env.MONGODB_API_PUB_KEY;
  const privateKey = process.env.MONGODB_API_PRIV_KEY;
  const host = process.env.MONGODB_HOST || process.env.MONGODB_CLUSTER;
  const appName = process.env.MONGODB_APP_NAME || "OmniSync";

  if (!publicKey || !privateKey || !host) {
    return null;
  }

  const encodedPassword = encodeURIComponent(privateKey);
  return `mongodb+srv://${publicKey}:${encodedPassword}@${host}/?appName=${encodeURIComponent(
    appName
  )}&retryWrites=true&w=majority`;
}

export const MONGODB_CREDENTIALS_DB = process.env.MONGODB_CREDENTIALS_DB || "OmniSyncCredentials";
export const MONGODB_INVENTORY_DB = process.env.MONGODB_INVENTORY_DB || "OmniSyncInventory";
export const MONGODB_POS_DB = process.env.MONGODB_POS_DB || "OmniSyncPOS";
export const MONGODB_SETTINGS_DB = process.env.MONGODB_SETTINGS_DB || "OmniSyncSettings";
export const MONGODB_ORGANIZATIONS_DB = process.env.MONGODB_ORGANIZATIONS_DB || "OmniSyncOrganizations";

export async function connectToMongo() {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    buildMongoUri();

  if (!mongoUri) {
    throw new Error(
      "Missing MongoDB connection configuration. Set MONGODB_URI or set MONGODB_HOST with MONGODB_API_PUB_KEY and MONGODB_API_PRIV_KEY."
    );
  }

  if (!cached.promise) {
    const defaultDb = process.env.MONGODB_DEFAULT_DB || "OmniSync";
    cached.promise = createConnection(mongoUri, defaultDb);
    global._mongoClientPromise = cached.promise;
    global._mongoClient = cached.conn as typeof mongoose;
  }

  return (await cached.promise) as typeof mongoose;
}

export function getMongoDb(dbName: string): Connection {
  if (!cached.conn) {
    throw new Error("MongoDB connection has not been initialized. Call connectToMongo() first.");
  }

  return cached.conn.connection.useDb(dbName, { useCache: true });
}
