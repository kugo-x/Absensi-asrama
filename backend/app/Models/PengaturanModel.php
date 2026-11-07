<?php

namespace App\Models;

use CodeIgniter\Model;

class PengaturanModel extends Model
{
    protected $table         = 'pengaturan';
    protected $primaryKey    = 'Kunci';
    protected $returnType    = 'array';
    protected $allowedFields = ['Kunci', 'Nilai', 'updated_at'];

    /**
     * Mode uji absensi: pengecualian aturan presensi untuk mencoba fitur
     *
     * @return array{abaikanJam: bool, abaikanRadius: bool}
     */
    public function modeUji(): array
    {
        $rows = $this->whereIn('Kunci', ['uji_abaikan_jam', 'uji_abaikan_radius'])->findAll();
        $nilai = array_column($rows, 'Nilai', 'Kunci');

        return [
            'abaikanJam'    => ($nilai['uji_abaikan_jam'] ?? '0') === '1',
            'abaikanRadius' => ($nilai['uji_abaikan_radius'] ?? '0') === '1',
        ];
    }

    public function simpanModeUji(bool $abaikanJam, bool $abaikanRadius): void
    {
        $now = date('Y-m-d H:i:s');
        $this->db->table($this->table)->replace(['Kunci' => 'uji_abaikan_jam', 'Nilai' => $abaikanJam ? '1' : '0', 'updated_at' => $now]);
        $this->db->table($this->table)->replace(['Kunci' => 'uji_abaikan_radius', 'Nilai' => $abaikanRadius ? '1' : '0', 'updated_at' => $now]);
    }
}
