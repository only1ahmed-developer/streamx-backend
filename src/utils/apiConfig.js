const axios = require('axios');

/**
 * Central place that knows how to reach the external content
 * provider(s). If StreamX later adds a second/backup provider,
 * only this file changes — nothing else in the backend, and
 * NOTHING in the Flutter app, needs to know about it.
 */
const getActiveBaseUrl = () => {
  return process.env.PRIMARY_CONTENT_API || 'https://davexmovieapi.zone.id';
};

const externalApi = axios.create({
  baseURL: getActiveBaseUrl(),
  timeout: 10000,
});

/**
 * Wraps a call to the external API with automatic fallback to the
 * backup provider (if configured) when the primary one fails.
 */
const fetchFromExternalApi = async (path, params = {}) => {
  try {
    const response = await externalApi.get(path, { params });
    return response.data;
  } catch (primaryError) {
    if (process.env.BACKUP_CONTENT_API) {
      console.warn(`[ExternalAPI] Primary failed for ${path}, trying backup...`);
      const backupResponse = await axios.get(`${process.env.BACKUP_CONTENT_API}${path}`, {
        params,
        timeout: 10000,
      });
      return backupResponse.data;
    }
    throw primaryError;
  }
};

module.exports = { externalApi, fetchFromExternalApi, getActiveBaseUrl };
