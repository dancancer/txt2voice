// If I change, please update my header comment.
// input: function args/external deps
// output: utility/service exports
// pos: shared library
import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connecting: Promise<RedisClient> | null = null;

export async function getRedisClient(): Promise<RedisClient | null> {
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
