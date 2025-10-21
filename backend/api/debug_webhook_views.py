import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from datetime import datetime

logger = logging.getLogger(__name__)

@api_view(['POST', 'GET', 'PUT', 'DELETE'])
@permission_classes([AllowAny])
@csrf_exempt
def debug_webhook(request):
    """
    Debug webhook endpoint to capture and log all incoming requests.
    This helps diagnose what OneTap is actually sending.
    """
    try:
        # Log everything about the request
        logger.info("=" * 80)
        logger.info(f"DEBUG WEBHOOK - {datetime.now().isoformat()}")
        logger.info(f"Method: {request.method}")
        logger.info(f"Path: {request.path}")
        logger.info(f"Full URL: {request.build_absolute_uri()}")
        logger.info(f"Headers: {dict(request.headers)}")
        logger.info(f"Content-Type: {request.content_type}")
        logger.info(f"Body length: {len(request.body)} bytes")
        
        # Log raw body
        if request.body:
            try:
                # Try to decode as text first
                body_text = request.body.decode('utf-8')
                logger.info(f"Raw body (text): {body_text}")
                
                # Try to parse as JSON
                try:
                    body_json = json.loads(body_text)
                    logger.info(f"Parsed JSON: {json.dumps(body_json, indent=2)}")
                except json.JSONDecodeError as e:
                    logger.info(f"JSON decode error: {e}")
                    logger.info("Body is not valid JSON")
            except UnicodeDecodeError:
                logger.info(f"Raw body (bytes): {request.body}")
        else:
            logger.info("Empty body")
        
        # Log query parameters
        if request.GET:
            logger.info(f"Query parameters: {dict(request.GET)}")
        
        # Log POST data
        if request.POST:
            logger.info(f"POST data: {dict(request.POST)}")
        
        logger.info("=" * 80)
        
        # Return a response that includes all the captured data
        response_data = {
            'debug': True,
            'timestamp': datetime.now().isoformat(),
            'method': request.method,
            'path': request.path,
            'headers': dict(request.headers),
            'content_type': request.content_type,
            'body_length': len(request.body),
            'query_params': dict(request.GET),
            'post_data': dict(request.POST),
        }
        
        if request.body:
            try:
                body_text = request.body.decode('utf-8')
                response_data['raw_body'] = body_text
                try:
                    response_data['parsed_json'] = json.loads(body_text)
                except json.JSONDecodeError:
                    response_data['json_error'] = "Body is not valid JSON"
            except UnicodeDecodeError:
                response_data['body_bytes'] = str(request.body)
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Debug webhook error: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Debug webhook failed', 'details': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([AllowAny])
def debug_webhook_status(request):
    """
    Status endpoint for debug webhook.
    """
    return Response({
        'status': 'debug_webhook_active',
        'message': 'Debug webhook is capturing all requests',
        'endpoint': '/api/webhook/debug/',
        'note': 'This endpoint logs all incoming data to help diagnose webhook issues'
    })






