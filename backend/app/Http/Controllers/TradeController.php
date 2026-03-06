<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TradeController extends Controller
{
    private const COMMISSION_PER_SIDE = 0.91;

    public function dashboard(): JsonResponse
    {
        $summary = DB::table('tradeReveal_orders')
            ->selectRaw('COUNT(*) as total_trades')
            ->selectRaw('COALESCE(SUM(lots), 0) as total_contracts')
            ->selectRaw('COALESCE(SUM(result_amount), 0) as gross_pnl')
            ->selectRaw('COALESCE(AVG(result_amount), 0) as avg_gross_pnl')
            ->selectRaw('SUM(CASE WHEN result_amount > 0 THEN 1 ELSE 0 END) as wins')
            ->selectRaw('SUM(CASE WHEN result_amount < 0 THEN 1 ELSE 0 END) as losses')
            ->selectRaw('COALESCE(SUM(CASE WHEN result_amount > 0 THEN result_amount ELSE 0 END), 0) as total_winnings')
            ->selectRaw('COALESCE(SUM(CASE WHEN result_amount < 0 THEN result_amount ELSE 0 END), 0) as total_losses')
            ->selectRaw('COALESCE(AVG(CASE WHEN result_amount > 0 THEN result_amount END), 0) as avg_winning_trade')
            ->selectRaw('COALESCE(AVG(CASE WHEN result_amount < 0 THEN result_amount END), 0) as avg_losing_trade')
            ->first();

        $currentMonth = now()->format('Y-m');

        $currentMonthSummary = DB::table('tradeReveal_orders')
            ->whereRaw("DATE_FORMAT(trade_date, '%Y-%m') = ?", [$currentMonth])
            ->selectRaw('COALESCE(SUM(result_amount), 0) as gross_pnl')
            ->selectRaw('COALESCE(SUM(lots), 0) as total_contracts')
            ->first();

        $monthlyPerformance = DB::table('tradeReveal_orders')
            ->selectRaw("DATE_FORMAT(trade_date, '%Y-%m') as month")
            ->selectRaw('COUNT(*) as trades')
            ->selectRaw('COALESCE(SUM(lots), 0) as total_contracts')
            ->selectRaw('COALESCE(SUM(result_amount), 0) as gross_pnl')
            ->selectRaw('SUM(CASE WHEN result_amount > 0 THEN 1 ELSE 0 END) as positive_trades')
            ->selectRaw('SUM(CASE WHEN result_amount < 0 THEN 1 ELSE 0 END) as negative_trades')
            ->groupBy('month')
            ->orderBy('month', 'asc')
            ->limit(12)
            ->get()
            ->map(function ($row) {
                $fees = $this->calculateCommission((float) $row->total_contracts);
                $grossPnl = (float) $row->gross_pnl;

                return [
                    'month' => $row->month,
                    'trades' => (int) $row->trades,
                    'total_contracts' => (float) $row->total_contracts,
                    'gross_pnl' => round($grossPnl, 2),
                    'fees' => round($fees, 2),
                    'net_pnl' => round($grossPnl - $fees, 2),
                    'positive_trades' => (int) $row->positive_trades,
                    'negative_trades' => (int) $row->negative_trades,
                ];
            })
            ->values();

        $dailyPerformance = DB::table('tradeReveal_orders')
            ->selectRaw('trade_date')
            ->selectRaw('COUNT(*) as trades')
            ->selectRaw('COALESCE(SUM(lots), 0) as total_contracts')
            ->selectRaw('COALESCE(SUM(result_amount), 0) as gross_pnl')
            ->groupBy('trade_date')
            ->orderBy('trade_date', 'asc')
            ->get()
            ->map(function ($row) {
                $fees = $this->calculateCommission((float) $row->total_contracts);
                $grossPnl = (float) $row->gross_pnl;

                return [
                    'trade_date' => $row->trade_date,
                    'trades' => (int) $row->trades,
                    'total_contracts' => (float) $row->total_contracts,
                    'gross_pnl' => round($grossPnl, 2),
                    'fees' => round($fees, 2),
                    'net_pnl' => round($grossPnl - $fees, 2),
                ];
            })
            ->values();

        $weekdayMap = [
            1 => 'Dom',
            2 => 'Lun',
            3 => 'Mar',
            4 => 'Mer',
            5 => 'Gio',
            6 => 'Ven',
            7 => 'Sab',
        ];

        $weekdayStats = DB::table('tradeReveal_orders')
            ->selectRaw('DAYOFWEEK(trade_date) as weekday_index')
            ->selectRaw('COUNT(*) as trades')
            ->selectRaw('COALESCE(SUM(lots), 0) as total_contracts')
            ->selectRaw('COALESCE(SUM(result_amount), 0) as gross_pnl')
            ->groupBy('weekday_index')
            ->orderBy('weekday_index')
            ->get()
            ->map(function ($row) use ($weekdayMap) {
                $fees = $this->calculateCommission((float) $row->total_contracts);
                $grossPnl = (float) $row->gross_pnl;

                return [
                    'weekday_index' => (int) $row->weekday_index,
                    'label' => $weekdayMap[(int) $row->weekday_index] ?? 'N/A',
                    'trades' => (int) $row->trades,
                    'gross_pnl' => round($grossPnl, 2),
                    'fees' => round($fees, 2),
                    'net_pnl' => round($grossPnl - $fees, 2),
                ];
            })
            ->values();

        $recentTrades = DB::table('tradeReveal_orders')
            ->select([
                'id',
                'contract_name',
                'trade_date',
                'time_it',
                'direction',
                'lots',
                'result_amount',
                'account',
                'setup_name',
            ])
            ->orderByDesc('trade_date')
            ->orderByDesc('time_it')
            ->limit(8)
            ->get()
            ->map(function ($trade) {
                $fees = $this->calculateCommission((float) $trade->lots);
                $grossPnl = (float) $trade->result_amount;

                return [
                    'id' => $trade->id,
                    'contract_name' => $trade->contract_name,
                    'trade_date' => $trade->trade_date,
                    'time_it' => $trade->time_it,
                    'direction' => $trade->direction,
                    'lots' => (float) $trade->lots,
                    'gross_pnl' => round($grossPnl, 2),
                    'fees' => round($fees, 2),
                    'net_pnl' => round($grossPnl - $fees, 2),
                    'account' => $trade->account,
                    'setup_name' => $trade->setup_name,
                ];
            })
            ->values();

        $winRate = (int) ($summary->total_trades ?? 0) > 0
            ? round(((int) ($summary->wins ?? 0) / (int) $summary->total_trades) * 100, 2)
            : 0;

        $totalContracts = (float) ($summary->total_contracts ?? 0);
        $totalFees = $this->calculateCommission($totalContracts);
        $grossPnl = (float) ($summary->gross_pnl ?? 0);
        $netPnl = $grossPnl - $totalFees;
        $currentMonthContracts = (float) ($currentMonthSummary->total_contracts ?? 0);
        $currentMonthGross = (float) ($currentMonthSummary->gross_pnl ?? 0);
        $currentMonthFees = $this->calculateCommission($currentMonthContracts);
        $grossLossAbs = abs((float) ($summary->total_losses ?? 0));
        $profitFactor = $grossLossAbs > 0
            ? round(((float) ($summary->total_winnings ?? 0)) / $grossLossAbs, 2)
            : 0;
        $expectancy = (int) ($summary->total_trades ?? 0) > 0
            ? round($netPnl / (int) $summary->total_trades, 2)
            : 0;

        return response()->json([
            'summary' => [
                'total_trades' => (int) ($summary->total_trades ?? 0),
                'total_contracts' => $totalContracts,
                'gross_pnl' => round($grossPnl, 2),
                'total_fees' => round($totalFees, 2),
                'net_pnl' => round($netPnl, 2),
                'avg_gross_pnl' => round((float) ($summary->avg_gross_pnl ?? 0), 2),
                'avg_net_pnl' => round((float) ($summary->avg_gross_pnl ?? 0) - ($this->calculateCommission($totalContracts) / max((int) ($summary->total_trades ?? 1), 1)), 2),
                'wins' => (int) ($summary->wins ?? 0),
                'losses' => (int) ($summary->losses ?? 0),
                'win_rate' => $winRate,
                'profit_factor' => $profitFactor,
                'expectancy' => $expectancy,
                'avg_winning_trade' => round((float) ($summary->avg_winning_trade ?? 0), 2),
                'avg_losing_trade' => round((float) ($summary->avg_losing_trade ?? 0), 2),
                'total_winnings' => round((float) ($summary->total_winnings ?? 0), 2),
                'total_losses' => round((float) ($summary->total_losses ?? 0), 2),
                'current_month_gross_pnl' => round($currentMonthGross, 2),
                'current_month_fees' => round($currentMonthFees, 2),
                'current_month_net_pnl' => round($currentMonthGross - $currentMonthFees, 2),
            ],
            'monthly_performance' => $monthlyPerformance,
            'daily_performance' => $dailyPerformance,
            'weekday_stats' => $weekdayStats,
            'recent_trades' => $recentTrades,
        ]);
    }

    public function index(): JsonResponse
    {
        $trades = DB::table('tradeReveal_orders')
            ->select([
                'id',
                'trade_date',
                'time_it',
                'time_ny',
                'contract_name',
                'direction',
                'lots',
                'entry_price',
                'exit_price',
                'stop_loss',
                'risk_amount',
                'result_amount',
                'setup_name',
                'account',
                'red_news',
                'notes',
                'broker_position_id',
            ])
            ->orderByDesc('trade_date')
            ->orderByDesc('time_it')
            ->limit(200)
            ->get()
            ->map(function ($trade) {
                $fees = $this->calculateCommission((float) $trade->lots);
                $grossPnl = (float) ($trade->result_amount ?? 0);

                return [
                    'id' => $trade->id,
                    'trade_date' => $trade->trade_date,
                    'time_it' => $trade->time_it,
                    'time_ny' => $trade->time_ny,
                    'contract_name' => $trade->contract_name,
                    'direction' => $trade->direction,
                    'lots' => (float) $trade->lots,
                    'entry_price' => $trade->entry_price,
                    'exit_price' => $trade->exit_price,
                    'stop_loss' => $trade->stop_loss,
                    'risk_amount' => $trade->risk_amount,
                    'gross_pnl' => round($grossPnl, 2),
                    'fees' => round($fees, 2),
                    'net_pnl' => round($grossPnl - $fees, 2),
                    'setup_name' => $trade->setup_name,
                    'account' => $trade->account,
                    'red_news' => (bool) $trade->red_news,
                    'notes' => $trade->notes,
                    'broker_position_id' => $trade->broker_position_id,
                ];
            })
            ->values();

        return response()->json([
            'trades' => $trades,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateTrade($request);

        $tradeId = DB::table('tradeReveal_orders')->insertGetId($this->mapTradeForInsert($validated));

        return response()->json([
            'message' => 'Trade salvato con successo.',
            'id' => $tradeId,
        ], 201);
    }

    public function import(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'trades' => ['required', 'array', 'min:1'],
            'trades.*.contract_name' => ['required', 'string', 'max:120'],
            'trades.*.trade_date' => ['required', 'date'],
            'trades.*.time_it' => ['nullable', 'string', 'max:8'],
            'trades.*.time_ny' => ['nullable', 'string', 'max:8'],
            'trades.*.lots' => ['required', 'numeric', 'gt:0'],
            'trades.*.direction' => ['required', 'in:long,short'],
            'trades.*.setup_name' => ['nullable', 'string', 'max:120'],
            'trades.*.entry_price' => ['nullable', 'numeric'],
            'trades.*.exit_price' => ['nullable', 'numeric'],
            'trades.*.stop_loss' => ['nullable', 'numeric'],
            'trades.*.risk_amount' => ['nullable', 'numeric'],
            'trades.*.notes' => ['nullable', 'string'],
            'trades.*.account' => ['nullable', 'string', 'max:120'],
            'trades.*.red_news' => ['required', 'boolean'],
            'trades.*.result_amount' => ['nullable', 'numeric'],
            'trades.*.broker_position_id' => ['nullable', 'string', 'max:64'],
        ]);

        $now = now();
        $incomingBrokerIds = collect($validated['trades'])
            ->pluck('broker_position_id')
            ->filter()
            ->unique()
            ->values();

        $existingBrokerIds = $incomingBrokerIds->isEmpty()
            ? collect()
            : DB::table('tradeReveal_orders')
                ->whereIn('broker_position_id', $incomingBrokerIds)
                ->pluck('broker_position_id');

        $rows = array_values(array_filter(array_map(function (array $trade) use ($now, $existingBrokerIds): ?array {
            if (! empty($trade['broker_position_id']) && $existingBrokerIds->contains($trade['broker_position_id'])) {
                return null;
            }

            return $this->mapTradeForInsert($trade, $now);
        }, $validated['trades'])));

        if (empty($rows)) {
            return response()->json([
                'message' => 'Nessun nuovo trade da importare.',
                'count' => 0,
                'skipped' => $incomingBrokerIds->count(),
            ], 200);
        }

        DB::table('tradeReveal_orders')->insert($rows);

        return response()->json([
            'message' => 'Import completato con successo.',
            'count' => count($rows),
            'skipped' => $existingBrokerIds->count(),
        ], 201);
    }

    private function validateTrade(Request $request): array
    {
        return $request->validate([
            'contract_name' => ['required', 'string', 'max:120'],
            'trade_date' => ['required', 'date'],
            'time_it' => ['nullable', 'string', 'max:8'],
            'time_ny' => ['nullable', 'string', 'max:8'],
            'lots' => ['required', 'numeric', 'gt:0'],
            'direction' => ['required', 'in:long,short'],
            'setup_name' => ['nullable', 'string', 'max:120'],
            'entry_price' => $this->quarterTickRules('Il prezzo di entrata deve rispettare tick da 0.25.'),
            'exit_price' => $this->quarterTickRules('Il prezzo di uscita deve rispettare tick da 0.25.'),
            'stop_loss' => $this->quarterTickRules('Lo stop loss deve rispettare tick da 0.25.'),
            'risk_amount' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string'],
            'account' => ['nullable', 'string', 'max:120'],
            'red_news' => ['required', 'boolean'],
            'result_amount' => ['nullable', 'numeric'],
            'broker_position_id' => ['nullable', 'string', 'max:64'],
        ]);
    }

    private function mapTradeForInsert(array $validated, $timestamp = null): array
    {
        $timestamp ??= now();

        return [
            'contract_name' => $validated['contract_name'],
            'trade_date' => $validated['trade_date'],
            'time_it' => $validated['time_it'] ?: null,
            'time_ny' => $validated['time_ny'] ?: null,
            'lots' => $validated['lots'],
            'direction' => $validated['direction'],
            'setup_name' => $validated['setup_name'] ?? null,
            'entry_price' => $validated['entry_price'] ?? null,
            'exit_price' => $validated['exit_price'] ?? null,
            'stop_loss' => $validated['stop_loss'] ?? null,
            'risk_amount' => $validated['risk_amount'] ?? null,
            'result_amount' => $validated['result_amount'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'account' => $validated['account'] ?? null,
            'red_news' => $validated['red_news'],
            'broker_position_id' => $validated['broker_position_id'] ?? null,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ];
    }

    private function isQuarterTick(mixed $value): bool
    {
        if ($value === null || $value === '') {
            return true;
        }

        $scaled = (int) round(((float) $value) * 100);

        return $scaled % 25 === 0;
    }

    private function quarterTickRules(string $message): array
    {
        return ['nullable', 'numeric', function ($attribute, $value, $fail) use ($message) {
            if (! $this->isQuarterTick($value)) {
                $fail($message);
            }
        }];
    }

    private function calculateCommission(float $contracts): float
    {
        return $contracts * 2 * self::COMMISSION_PER_SIDE;
    }
}
