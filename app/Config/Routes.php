<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');

$routes->group('api', static function ($routes) {
    // Auth
    $routes->post('auth/login', 'Api\AuthController::login');
    $routes->options('auth/login', static function () {
        return response()->setStatusCode(200);
    });

    // Master Data
    $routes->get('gedung', 'Api\DataController::getGedung');
    $routes->get('kamar', 'Api\DataController::getKamar');
    
    // Penghuni
    $routes->get('penghuni', 'Api\DataController::getPenghuni');
    $routes->post('penghuni', 'Api\DataController::addPenghuni');
    $routes->post('penghuni/toggle-status', 'Api\DataController::togglePenghuniStatus');

    // Presensi
    $routes->get('presensi', 'Api\DataController::getPresensi');
    $routes->post('presensi', 'Api\DataController::checkIn');

    // Izin
    $routes->get('izin', 'Api\DataController::getIzin');
    $routes->post('izin', 'Api\DataController::addIzin');
    $routes->post('izin/status', 'Api\DataController::updateIzinStatus');

    // Generic OPTIONS handler for CORS preflight
    $routes->options('(:any)', static function () {
        return response()->setStatusCode(200);
    });
});
