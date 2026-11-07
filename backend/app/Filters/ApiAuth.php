<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class ApiAuth implements FilterInterface
{

    public function before(RequestInterface $request, $arguments = null)
    {
        $header = $request->getHeaderLine('Authorization');
        $raw = preg_replace('/^Bearer\s+/i', '', $header);
        [$encoded, $signature] = array_pad(explode('.', $raw, 2), 2, '');
        $payload = base64_decode(strtr($encoded, '-_', '+/'));
        $data = json_decode($payload ?: '', true);
        $expected = hash_hmac('sha256', $encoded, env('encryption.key', 'sip-asrama-v1'));

        if (!$data || !$signature || !hash_equals($expected, $signature) || ($data['exp'] ?? 0) < time()) {
            return service('response')->setStatusCode(401)->setJSON(['status' => 401, 'error' => 'Token login tidak valid atau sudah kedaluwarsa.']);
        }

    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }
}
