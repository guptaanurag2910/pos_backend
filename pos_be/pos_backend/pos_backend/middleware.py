import logging
import time


logger = logging.getLogger("pos.trace")


class RequestTraceMiddleware:
    """
    Trace each request/response for debugging and flow tracking.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.perf_counter()
        user_id = getattr(getattr(request, "user", None), "id", None)
        logger.info(
            f"REQ method={request.method} path={request.path} user_id={user_id} ip={request.META.get('REMOTE_ADDR')}"
        )

        try:
            response = self.get_response(request)
        except Exception as exc:  # noqa: BLE001
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                f"REQ_ERR method={request.method} path={request.path} user_id={user_id} duration_ms={duration_ms:.2f} error={exc}"
            )
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            f"RESP method={request.method} path={request.path} status={response.status_code} user_id={user_id} duration_ms={duration_ms:.2f}"
        )
        return response

