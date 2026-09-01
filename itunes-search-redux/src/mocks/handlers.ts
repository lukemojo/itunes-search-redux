import { http, HttpResponse } from 'msw';

/** Wraps results in the iTunes response envelope. */
const itunesPayload = (results: unknown[]) => ({ resultCount: results.length, results });

/**
 * MSW handlers for mocking iTunes API requests. Each handler responds to a GET request to the iTunes search endpoint
 * with a different payload based on the 'entity' query parameter.
 * If the 'entity' parameter is not recognized, it defaults to returning a mock song result.
 */
const handlers = [
  http.get('https://itunes.apple.com/search', ({ request }) => {
    const url = new URL(request.url);
    switch (url.searchParams.get('entity')) {
      case 'musicArtist':
        return HttpResponse.json(
          itunesPayload([{ wrapperType: 'artist', artistId: 1, artistName: 'Radiohead' }]),
        );
      case 'album':
        return HttpResponse.json(
          itunesPayload([
            {
              wrapperType: 'collection',
              collectionId: 2,
              collectionName: 'OK Computer',
              artistName: 'Radiohead',
            },
          ]),
        );
      default:
        return HttpResponse.json(
          itunesPayload([
            {
              wrapperType: 'track',
              kind: 'song',
              trackId: 3,
              trackName: 'Karma Police',
              artistName: 'Radiohead',
            },
          ]),
        );
    }
  }),
];

export { handlers };
