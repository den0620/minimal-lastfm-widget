export default {
  async fetch(request) {
    const url = new URL(request.url);
    const params = url.searchParams;

    const API_KEY = 'PASTE_YOUR_LAST_FM_API_KEY_HERE';
    const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
    
    const username = params.get('user') || params.get('username');
    const type = params.get('type') || 'full';
    const format = params.get('format') || 'json';
    
    if (!username) {
      return new Response(JSON.stringify({ error: 'Username parameter required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const apiUrl = new URL(API_BASE);
    apiUrl.searchParams.append('method', 'user.getrecenttracks');
    apiUrl.searchParams.append('user', username);
    apiUrl.searchParams.append('api_key', API_KEY);
    apiUrl.searchParams.append('format', 'json');
    apiUrl.searchParams.append('limit', '1');
    
    try {
      const response = await fetch(apiUrl.toString(), {
        headers: {
          'User-Agent': 'Worker/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Last.fm API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Last.fm API error');
      }
      
      const track = data.recenttracks?.track?.[0];
      if (!track) {
        throw new Error('No recent tracks found');
      }
      
      const trackInfo = {
        name: track.name,
        artist: track.artist['#text'],
        album: track.album['#text'],
        url: track.url,
        image: track.image?.[3]?.['#text'] || track.image?.[2]?.['#text'] || '',
        nowplaying: track['@attr']?.nowplaying === 'true',
        timestamp: track.date?.uts || Math.floor(Date.now() / 1000)
      };
      
      const artistUrl = `https://www.last.fm/music/${encodeURIComponent(trackInfo.artist.replace(/ /g, '+'))}`;
      
      let responseData;
      let contentType = 'application/json';
      
      switch (type) {
        case 'cover':
        case 'image':
          if (format === 'redirect' && trackInfo.image) {
            // Redirect to image URL
            return Response.redirect(trackInfo.image, 302);
          } else if (format === 'base64' && trackInfo.image) {
            // Fetch and return image as base64
            const imgResponse = await fetch(trackInfo.image);
            const imgBuffer = await imgResponse.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
            responseData = {
              data: `data:${imgResponse.headers.get('content-type')};base64,${base64}`,
              url: trackInfo.image
            };
          } else {
            responseData = trackInfo.image;
          }
          break;
          
        case 'name':
        case 'title':
          responseData = trackInfo.name;
          if (format === 'text') contentType = 'text/plain';
          break;
          
        case 'artist':
          responseData = trackInfo.artist;
          if (format === 'text') contentType = 'text/plain';
          break;
          
        case 'album':
          responseData = trackInfo.album;
          if (format === 'text') contentType = 'text/plain';
          break;
          
        case 'url':
          responseData = trackInfo.url;
          if (format === 'text') contentType = 'text/plain';
          break;
          
        case 'nowplaying':
          responseData = trackInfo.nowplaying;
          break;
          
        case 'widget':
          contentType = 'text/html';
          responseData = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        margin: 0;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: transparent;
                    }
                    .widget {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px;
                        background: transparent;
                        border-radius: 8px;
                    }
                    .cover-link {
                        display: block;
                        text-decoration: none;
                        transition: transform 0.2s ease;
                    }
                    .cover {
                        width: 64px;
                        height: 64px;
                        border-radius: 4px;
                        background: rgba(0, 0, 0, 0.1);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                        display: block;
                    }
                    .info {
                        flex: 1;
                        min-width: 0;
                    }
                    .track-link {
                        text-decoration: none;
                        color: inherit;
                        display: block;
                    }
                    .track {
                        font-weight: 600;
                        font-size: 14px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        color: #000;
                        text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
                        transition: opacity 0.2s ease;
                    }
                    .track-link:hover .track {
                        opacity: 0.8;
                    }
                    .artist-link {
                        text-decoration: none;
                        color: inherit;
                        display: block;
                    }
                    .artist {
                        font-size: 13px;
                        color: #333;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
                        transition: opacity 0.2s ease;
                    }
                    .artist-link:hover .artist {
                        opacity: 0.7;
                    }
                    .nowplaying {
                        display: inline-block;
                        width: 8px;
                        height: 8px;
                        background: #1db954;
                        border-radius: 50%;
                        margin-right: 4px;
                        animation: pulse 2s infinite;
                        box-shadow: 0 0 4px rgba(29, 185, 84, 0.5);
                    }
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.5; }
                        100% { opacity: 1; }
                    }
                    
                    @media (prefers-color-scheme: dark) {
                        .track {
                            color: #fff;
                            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
                        }
                        .artist {
                            color: #ccc;
                            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
                        }
                        .cover {
                            background: rgba(255, 255, 255, 0.1);
                        }
                    }
                </style>
            </head>
            <body>
                <div class="widget">
                    <a href="${trackInfo.url}" target="_blank" rel="noopener noreferrer" class="cover-link">
                        ${trackInfo.image ? `<img class="cover" src="${trackInfo.image}" alt="Album cover">` : '<div class="cover"></div>'}
                    </a>
                    <div class="info">
                        <a href="${trackInfo.url}" target="_blank" rel="noopener noreferrer" class="track-link">
                            <div class="track">
                                ${trackInfo.nowplaying ? '<span class="nowplaying"></span>' : ''}
                                ${trackInfo.name}
                            </div>
                        </a>
                        <a href="${artistUrl}" target="_blank" rel="noopener noreferrer" class="artist-link">
                            <div class="artist">${trackInfo.artist}</div>
                        </a>
                    </div>
                </div>
            </body>
            </html>
          `;
          break;
          
        case 'full':
        default:
          responseData = trackInfo;
      }
      
      // Format response
      let body;
      if (contentType === 'text/html') {
        body = responseData;
      } else if (contentType === 'text/plain') {
        body = String(responseData);
      } else {
        body = JSON.stringify(responseData);
      }
      
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=30'
        }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
