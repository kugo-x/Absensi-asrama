<?php

namespace App\Filters;

use App\Libraries\LogAktivitas;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Mencatat setiap permintaan yang mengubah data (POST) ke log aktivitas setelah diproses,
 * termasuk yang gagal/ditolak. Seeder juga dicatat walau dipanggil lewat GET.
 */
class CatatAktivitas implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        $metode = strtoupper($request->getMethod());
        $seeder = trim($request->getPath(), '/') === 'api/seed';
        if ($metode === 'POST' || ($metode === 'GET' && $seeder)) {
            LogAktivitas::dariPermintaan($request, $response);
        }
    }
}
