import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
export const empty = () => ({ version: 1, orders: {}, audit: [] });
export class FileStore {
  constructor(path = ".data/reservations.json") {
    this.path = path;
    this.tail = Promise.resolve();
  }
  async read() {
    try {
      return JSON.parse(await readFile(this.path, "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return empty();
      throw e;
    }
  }
  transaction(fn) {
    const job = this.tail.then(async () => {
      const data = await this.read();
      const result = fn(data);
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(this.path + ".tmp", JSON.stringify(data), {
        mode: 0o600,
      });
      await rename(this.path + ".tmp", this.path);
      return result;
    });
    this.tail = job.catch(() => {});
    return job;
  }
}
// One bounded launch ledger: conditional replacement provides a serializable commit
// across Lambda invocations. No external side effects may run in transaction callbacks.
export class S3Store {
  constructor(bucket, client = new S3Client({})) {
    this.bucket = bucket;
    this.client = client;
  }
  async snapshot() {
    try {
      const r = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: "reservations.json" }),
      );
      return {
        data: JSON.parse(await r.Body.transformToString()),
        etag: r.ETag,
      };
    } catch (e) {
      if (e.name === "NoSuchKey") return { data: empty() };
      throw e;
    }
  }
  async read() {
    return (await this.snapshot()).data;
  }
  async transaction(fn) {
    for (let i = 0; i < 12; i++) {
      const { data, etag } = await this.snapshot();
      const result = fn(data);
      try {
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: "reservations.json",
            Body: JSON.stringify(data),
            ContentType: "application/json",
            ServerSideEncryption: "AES256",
            ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }),
          }),
        );
        return result;
      } catch (e) {
        if (![409, 412].includes(e.$metadata?.httpStatusCode)) throw e;
        await new Promise((r) =>
          setTimeout(r, 25 + Math.random() * 100 * (i + 1)),
        );
      }
    }
    throw Object.assign(new Error("Busy; please retry."), { status: 503 });
  }
}
