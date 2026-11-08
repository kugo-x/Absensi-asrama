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

    /**
     * Aturan presensi yang diatur admin (nilai bawaan dipakai bila kunci belum ada)
     *
     * @return array{gpsAkurasiMaks: int, batasTidakHadir: int, pengingatMenit: int}
     */
    public function aturanPresensi(): array
    {
        $rows  = $this->whereIn('Kunci', ['gps_akurasi_maks', 'batas_tidak_hadir', 'pengingat_menit'])->findAll();
        $nilai = array_column($rows, 'Nilai', 'Kunci');

        return [
            'gpsAkurasiMaks'  => (int) ($nilai['gps_akurasi_maks'] ?? 100),
            'batasTidakHadir' => (int) ($nilai['batas_tidak_hadir'] ?? 3),
            'pengingatMenit'  => (int) ($nilai['pengingat_menit'] ?? 15),
        ];
    }

    /**
     * @param array{gpsAkurasiMaks: int, batasTidakHadir: int, pengingatMenit: int} $aturan
     */
    public function simpanAturanPresensi(array $aturan): void
    {
        $now = date('Y-m-d H:i:s');
        $this->db->table($this->table)->replace(['Kunci' => 'gps_akurasi_maks', 'Nilai' => (string) $aturan['gpsAkurasiMaks'], 'updated_at' => $now]);
        $this->db->table($this->table)->replace(['Kunci' => 'batas_tidak_hadir', 'Nilai' => (string) $aturan['batasTidakHadir'], 'updated_at' => $now]);
        $this->db->table($this->table)->replace(['Kunci' => 'pengingat_menit', 'Nilai' => (string) $aturan['pengingatMenit'], 'updated_at' => $now]);
    }

    public function simpanModeUji(bool $abaikanJam, bool $abaikanRadius): void
    {
        $now = date('Y-m-d H:i:s');
        $this->db->table($this->table)->replace(['Kunci' => 'uji_abaikan_jam', 'Nilai' => $abaikanJam ? '1' : '0', 'updated_at' => $now]);
        $this->db->table($this->table)->replace(['Kunci' => 'uji_abaikan_radius', 'Nilai' => $abaikanRadius ? '1' : '0', 'updated_at' => $now]);
    }
}
