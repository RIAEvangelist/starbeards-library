function hasAssetsBinding(environment) {
    return environment
        && environment.ASSETS
        && typeof environment.ASSETS.fetch === 'function';
}

const siteWorker = {
    async fetch(request, environment) {
        if (!hasAssetsBinding(environment)) {
            return new Response('The storybook assets are not available.', {
                status: 503,
                headers: {
                    'content-type': 'text/plain; charset=utf-8',
                },
            });
        }

        return environment.ASSETS.fetch(request);
    },
};

export default siteWorker;

