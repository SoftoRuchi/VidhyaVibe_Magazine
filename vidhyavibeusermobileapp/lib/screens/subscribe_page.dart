import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../config/apiConfig.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/viewing_context.dart';
import '../utils/delivery_modes.dart';
import '../widgets/auth_widgets.dart';
import 'main_shell.dart';

class SubscribePage extends StatefulWidget {
  const SubscribePage({super.key, this.initialMagazineId});

  final int? initialMagazineId;

  @override
  State<SubscribePage> createState() => _SubscribePageState();
}

class _SubscribePageState extends State<SubscribePage> {
  final _couponController = TextEditingController();

  late Razorpay _razorpay;
  bool _loading = true;
  bool _paying = false;
  bool _isChild = false;
  String? _error;

  List<MagazineSummary> _magazines = [];
  List<SubscriptionPlan> _plans = [];
  MagazineSummary? _selectedMagazine;
  SubscriptionPlan? _selectedPlan;
  String _deliveryMode = DeliveryModes.electronic;

  int? _pendingOrderId;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
    _bootstrap();
  }

  @override
  void dispose() {
    _couponController.dispose();
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final isChild = await ViewingContext.isChildAudience();
      if (isChild) {
        if (!mounted) return;
        setState(() {
          _isChild = true;
          _loading = false;
        });
        return;
      }

      final magRes = await ApiClient.listMagazines();
      if (!ApiClient.isOk(magRes)) {
        throw Exception('Could not load magazines');
      }
      final magazines = ApiClient.decodeList(magRes)
          .whereType<Map>()
          .map((m) => MagazineSummary.fromJson(Map<String, dynamic>.from(m)))
          .toList();

      MagazineSummary? selected;
      if (widget.initialMagazineId != null) {
        selected = magazines
            .where((m) => m.id == widget.initialMagazineId)
            .cast<MagazineSummary?>()
            .firstWhere((m) => m != null, orElse: () => null);
      }
      selected ??= magazines.isNotEmpty ? magazines.first : null;

      if (!mounted) return;
      setState(() {
        _magazines = magazines;
        _selectedMagazine = selected;
        _loading = false;
      });
      if (selected != null) await _loadPlans(selected.id);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _loadPlans(int magazineId) async {
    try {
      final res = await ApiClient.listPlans(magazineId: magazineId);
      final plans = ApiClient.isOk(res)
          ? ApiClient.decodeList(res)
              .whereType<Map>()
              .map((p) => SubscriptionPlan.fromJson(Map<String, dynamic>.from(p)))
              .toList()
          : <SubscriptionPlan>[];
      if (!mounted) return;
      setState(() {
        _plans = plans;
        _selectedPlan = plans.isNotEmpty ? plans.first : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _plans = [];
        _selectedPlan = null;
      });
    }
  }

  num get _displayPrice {
    final plan = _selectedPlan;
    if (plan == null) return 0;
    return plan.priceFor(_deliveryMode);
  }

  Future<void> _pay() async {
    final magazine = _selectedMagazine;
    final plan = _selectedPlan;
    if (magazine == null || plan == null) return;

    setState(() => _paying = true);
    try {
      final body = <String, dynamic>{
        'planId': plan.id,
        'magazineId': magazine.id,
        'months': plan.defaultMonths,
        'deliveryMode': _deliveryMode,
      };
      final coupon = _couponController.text.trim();
      if (coupon.isNotEmpty) body['couponCode'] = coupon;

      final res = await ApiClient.createPaymentOrder(body);
      final data = ApiClient.decodeMap(res);
      if (!ApiClient.isOk(res)) {
        throw Exception(
          data['message']?.toString() ??
              data['error']?.toString() ??
              'Could not create payment order',
        );
      }

      final rpOrderId = data['rpOrderId']?.toString();
      final orderId = data['orderId'];
      final amountRupees = (data['finalAmount'] ?? data['amount']) is num
          ? (data['finalAmount'] ?? data['amount']) as num
          : num.tryParse('${data['finalAmount'] ?? data['amount']}') ?? 0;
      final currency = data['currency']?.toString() ?? 'INR';

      if (rpOrderId == null || rpOrderId.isEmpty) {
        throw Exception('Razorpay order missing');
      }

      _pendingOrderId = orderId is int ? orderId : int.tryParse('$orderId');

      var meName = '';
      var meEmail = '';
      var mePhone = '';
      try {
        final meRes = await ApiClient.getMe();
        if (ApiClient.isOk(meRes)) {
          final me = ApiClient.decodeMap(meRes);
          meName = me['name']?.toString() ?? '';
          meEmail = me['email']?.toString() ?? '';
          mePhone = me['phone']?.toString() ??
              (me['guardians'] is List && (me['guardians'] as List).isNotEmpty
                  ? ((me['guardians'] as List).first as Map)['phone']?.toString() ??
                      ''
                  : '');
        }
      } catch (_) {}

      final options = {
        'key': ApiConfig.razorpayKeyId,
        'amount': (amountRupees * 100).round(),
        'currency': currency,
        'name': 'VidhyaVibe',
        'description': '${magazine.title} · ${plan.name}',
        'order_id': rpOrderId,
        'prefill': {
          'name': meName,
          'email': meEmail,
          'contact': mePhone.replaceAll(RegExp(r'\D'), '').length >= 10
              ? mePhone.replaceAll(RegExp(r'\D'), '').substring(
                    mePhone.replaceAll(RegExp(r'\D'), '').length - 10,
                  )
              : mePhone,
        },
        'theme': {'color': '#2D7A3E'},
      };
      _razorpay.open(options);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    if (_pendingOrderId == null) return;
    setState(() => _paying = true);
    try {
      final res = await ApiClient.confirmRazorpay({
        'orderId': _pendingOrderId,
        'razorpay_payment_id': response.paymentId,
        'razorpay_order_id': response.orderId,
        'razorpay_signature': response.signature,
      });
      if (!mounted) return;
      if (ApiClient.isOk(res)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Subscription activated!')),
        );
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const MainShell(initialIndex: 1)),
          (_) => false,
        );
      } else {
        final data = ApiClient.decodeMap(res);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(data, fallback: 'Payment confirm failed'),
            ),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment confirm failed')),
      );
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(response.message ?? 'Payment cancelled or failed'),
      ),
    );
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Wallet: ${response.walletName}')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AuthTheme.buildAppBar('Subscribe'),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _isChild
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'Subscriptions are managed by a parent account. Switch to parent to subscribe.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AuthTheme.mutedBrown),
                      ),
                    ),
                  )
                : _error != null
                    ? Center(child: Text(_error!))
                    : ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          const Text(
                            'Choose a magazine plan',
                            style: TextStyle(
                              fontFamily: 'serif',
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: AuthTheme.brown,
                            ),
                          ),
                          const SizedBox(height: 16),
                          DropdownButtonFormField<int>(
                            isExpanded: true,
                            value: _selectedMagazine?.id,
                            decoration: AuthTheme.fieldDecoration(
                              label: 'Magazine',
                            ),
                            items: _magazines
                                .map(
                                  (m) => DropdownMenuItem(
                                    value: m.id,
                                    child: Text(
                                      m.title,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (id) async {
                              if (id == null) return;
                              final mag = _magazines.firstWhere((m) => m.id == id);
                              setState(() => _selectedMagazine = mag);
                              await _loadPlans(id);
                            },
                          ),
                          const SizedBox(height: 14),
                          DropdownButtonFormField<int>(
                            isExpanded: true,
                            value: _selectedPlan?.id,
                            decoration: AuthTheme.fieldDecoration(label: 'Plan'),
                            items: _plans
                                .map(
                                  (p) => DropdownMenuItem(
                                    value: p.id,
                                    child: Text(
                                      p.name,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (id) {
                              if (id == null) return;
                              setState(() {
                                _selectedPlan =
                                    _plans.firstWhere((p) => p.id == id);
                              });
                            },
                          ),
                          const SizedBox(height: 14),
                          DropdownButtonFormField<String>(
                            isExpanded: true,
                            value: _deliveryMode,
                            decoration:
                                AuthTheme.fieldDecoration(label: 'Delivery'),
                            items: DeliveryModes.dropdownItems
                                .map(
                                  (o) => DropdownMenuItem(
                                    value: o.value,
                                    child: Text(
                                      o.label,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (v) {
                              if (v != null) setState(() => _deliveryMode = v);
                            },
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _couponController,
                            decoration: AuthTheme.fieldDecoration(
                              label: 'Coupon code (optional)',
                            ),
                          ),
                          const SizedBox(height: 20),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.85),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              children: [
                                const Text(
                                  'Amount',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: AuthTheme.brown,
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  '₹${_displayPrice.toStringAsFixed(0)}',
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w800,
                                    color: AuthTheme.green,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_selectedPlan != null) ...[
                            const SizedBox(height: 8),
                            Text(
                              '${_selectedPlan!.defaultMonths} months · ${_selectedPlan!.name}',
                              style: const TextStyle(
                                color: AuthTheme.mutedBrown,
                                fontSize: 13,
                              ),
                            ),
                          ],
                          const SizedBox(height: 24),
                          AuthPrimaryButton(
                            label: 'Pay',
                            loading: _paying,
                            onPressed: _selectedPlan == null ? null : _pay,
                          ),
                        ],
                      ),
      ),
    );
  }
}
