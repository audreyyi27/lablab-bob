(function () {
  const origin = window.location.origin;
  const isLocal =
    origin.includes('localhost') || origin.includes('127.0.0.1');

  window.REPOTALK_API_BASE =
    typeof window.REPOTALK_API_BASE === 'string'
      ? window.REPOTALK_API_BASE.replace(/\/$/, '')
      : isLocal
        ? 'http://localhost:3000'
        : origin;  
})();