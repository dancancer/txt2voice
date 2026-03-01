import { createClient, RedisClientType } from "redis";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (client) return client;
  if (connecting) return connecting;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  connecting = (async () => {
    const instance = createClient({ url });
    instance.on("error", (error) => {
      console.error("[redis] error", error);
    });
    await instance.connect();
    client = instance;
    connecting = null;
    return instance;
  })();

  try {
    return await connecting;
  } catch (error) {
    console.error("[redis] connect failed", error);
    connecting = null;
    return null;
  }
}
