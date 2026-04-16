export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Proxy para los MP3 de TTS con headers CORS
        if (url.pathname.startsWith('/sites/default/files/tts/')) {
            const upstream = 'https://dev-step-up-tours.pantheonsite.io' + url.pathname;

            // Responder al preflight OPTIONS
            if (request.method === 'OPTIONS') {
                return new Response(null, {
                    status: 204,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    },
                });
            }

            const response = await fetch(upstream);
            const newResponse = new Response(response.body, response);
            newResponse.headers.set('Access-Control-Allow-Origin', '*');
            newResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
            return newResponse;
        }

        // Todo lo demás → servir la app estática normal
        return env.ASSETS.fetch(request);
    },
};