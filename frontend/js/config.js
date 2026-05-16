(function () {
  const origin = window.location.origin;
  const isServedByBackend =
    window.location.port === '3000' ||
    (window.location.port === '' && origin.includes('localhost'));

  window.REPOTALK_API_BASE =
    typeof window.REPOTALK_API_BASE === 'string'
      ? window.REPOTALK_API_BASE.replace(/\/$/, '')
      : isServedByBackend
        ? ''
        : 'http://localhost:3000';
})();
