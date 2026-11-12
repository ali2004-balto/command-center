// Loads the Bridge feed and builds the model for the current moment.
import { DateTime } from 'luxon';
import { appTimezone, isMock } from './env';
import { getFeed } from './bridge/feed';
import { buildModel, type Model } from './domain/model';

export async function loadModel(): Promise<Model> {
  const tz = appTimezone();
  const result = await getFeed();
  return buildModel({ result, now: DateTime.now().setZone(tz), demo: isMock(), appTimezone: tz });
}
