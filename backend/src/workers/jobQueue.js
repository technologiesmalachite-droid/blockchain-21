import { outboxRepository } from "../repositories/outboxRepository.js";

export const jobQueue = {
  // Redis worker bridge hook. In production, a worker can read from events_outbox and fan out to Redis streams.
  async publish(topic, payload, db) {
    return outboxRepository.enqueue({ topic, payload }, db);
  },
};
