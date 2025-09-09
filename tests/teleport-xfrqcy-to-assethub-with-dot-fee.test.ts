import { testingPairs } from '@acala-network/chopsticks-testing';
import networks, { type Network } from './networks';
import { describe, it, expect } from 'vitest';
import { withExpect } from '@acala-network/chopsticks-testing';
import { setStorage } from '@acala-network/chopsticks';
import { getSiblingSovereignAccount } from './util';

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);

describe.only('Teleport XFRQCY to AssetHub with DOT fee', () => {
  let frequency: Network;
  let assetHub: Network;

  beforeEach(async () => {
    frequency = await networks.frequency();
    assetHub = await networks.assetHub();

    frequency.chain.setHead(frequency.chain.head);
    assetHub.chain.setHead(assetHub.chain.head);

    const blockNumberFrequency = (await frequency.api.rpc.chain.getHeader()).number.toNumber();
    frequency.dev.setHead(blockNumberFrequency);

    const blockNumberAssetHub = (await assetHub.api.rpc.chain.getHeader()).number.toNumber();
    assetHub.dev.setHead(blockNumberAssetHub);
  });

  afterEach(async () => {
    await frequency.teardown();
    await assetHub.teardown();
  });

  it('Teleport XFRQCY to AssetHub with DOT fee', async () => {
    const { alice, bob } = testingPairs();

    const paraId = 2091;
    const siblingSovereignAccount = await getSiblingSovereignAccount(paraId);
    console.log('siblingSovereignAccount', siblingSovereignAccount);
    const sib = '5Eg2fnsixbRfQGTeUNds5WBdpL3gvhUzF9yPCnaKX43Pc7Dk';

    await setStorage(frequency.chain, {
      System: {
        Account: [
          [[alice.address], { data: { free: 1000 * 1e12 } }],
          [[sib], { data: { free: 1000 * 1e12 } }],
        ],
      },
    });

    await setStorage(assetHub.chain, {
      System: {
        Account: [[alice.address], { data: { free: 1000 * 1e12 } }],
      },
      ForeignAssets: {
        Asset: [[[{ parents: 1, interior: 'Here' }], { supply: 1000e10, owner: alice.address }]],
        Account: [
          [
            [alice.address],
            {
              balance: 100 * 1e12,
              status: { Liquid: null },
              reason: { Consumer: null },
              extra: null,
            },
          ],
        ],
      },
      PolkadotXcm: {
        SafeXcmVersion: 3,
        SupportedVersion: [
          [[5, { V5: { parents: 1, interior: { X1: [{ Parachain: 1000 }] } } }], 4],
        ],
      },
    });

    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot();
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot();

    await check(
      frequency.api.query.foreignAssets.account(
        {
          parents: 1,
          interior: 'Here',
        },
        alice.address
      )
    ).toMatchSnapshot();

    await frequency.chain.newBlock();
    await assetHub.chain.newBlock();

    const xcm = [
      {
        WithdrawAsset: {
          assets: [
            {
              id: { Concrete: { parents: 1, interior: 'Here' } },
              fun: { Fungible: 100 * 1e12 },
            },
            {
              id: { Concrete: { parents: 0, interior: 'Here' } },
              fun: { Fungible: 100 * 1e12 },
            }
          ],
        },
      },
      {
        InitiateTransfer: {
          destination: {
            V3: {
              parents: 1,
              interior: { X1: { Parachain: 2091 } },
            },
          },
        },
      },
      {
        RefundSurplus: {
          assets: [
            {
              id: { Concrete: { parents: 1, interior: 'Here' } },
              fun: { Fungible: 100 * 1e12 },
            },
          ],
        },
      },
      {
        DepositAsset: {
          assets: [
            {
              id: { Concrete: { parents: 1, interior: 'Here' } },
              fun: { Fungible: 100 * 1e12 },
            },
          ],
        },
      },
      {
        ClearOrigin: null,
      },
      {
        BuyExecution: {
          fees: {
            id: { Concrete: { parents: 1, interior: 'Here' } },
            fun: { Fungible: 100 * 1e12 },
          },
          weightLimit: 'Unlimited',
        },
      },
    ];

    await frequency.api.tx.polkadotXcm.execute(xcm);
    
    await frequency.chain.newBlock();
    await assetHub.chain.newBlock();

    await checkSystemEvents(frequency).toMatchSnapshot();
    await checkSystemEvents(assetHub).toMatchSnapshot();

    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot();
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot();
  });
});

// fn execute_xcm_frequency_to_asset_hub(t: FrequencyToAssetHubTest) -> DispatchResult {
// 	let assets: Assets = t.args.assets.clone();

// 	let local_teleportable_asset: Asset =
// 		non_fee_asset(&assets, t.args.fee_asset_item as usize).unwrap().into();
// 	// TODO(https://github.com/paritytech/polkadot-sdk/issues/6197): dry-run to get exact fees.
// 	// For now )just use half the fees locally, half on dest

// 	// Use half of the fees to cover remote execution and the
// 	// remainding to cover delivery fees
// 	let mut remote_execution_fee_asset: Asset =
// 		fee_asset(&assets, t.args.fee_asset_item as usize).unwrap().into();
// 	if let Fungible(fees_amount) = remote_execution_fee_asset.fun {
// 		remote_execution_fee_asset.fun = Fungible(fees_amount / 2);
// 	}

// 	let xcm_on_dest = Xcm(vec![
// 		RefundSurplus,
// 		DepositAsset { assets: Wild(All), beneficiary: t.args.beneficiary },
// 	]);

// 	let xcm = Xcm::<()>(vec![
// 		WithdrawAsset(assets),
// 		// PayFees { asset: remote_fees.clone() },
// 		InitiateTransfer {
// 			destination: t.args.dest,
// 			remote_fees: Some(AssetTransferFilter::ReserveWithdraw(
// 				remote_execution_fee_asset.into(),
// 			)),
// 			preserve_origin: false,
// 			assets: BoundedVec::truncate_from(vec![AssetTransferFilter::Teleport(
// 				local_teleportable_asset.into(),
// 			)]),
// 			remote_xcm: xcm_on_dest,
// 		},
// 		RefundSurplus,
// 		DepositAsset {
// 			assets: Wild(All),
// 			beneficiary: AccountId32Junction {
// 				network: None,
// 				id: FrequencyWestendSender::get().into(),
// 			}
// 			.into(),
// 		},
// 	]);

// 	<FrequencyWestend as FrequencyWestendPallet>::PolkadotXcm::execute(
// 		t.signed_origin,
// 		bx!(staging_xcm::VersionedXcm::from(xcm.into())),
// 		Weight::MAX,
// 	)
// 	.unwrap();
// 	Ok(())
// }

// function teleportXfrqcyToAssethubWithDotFee() {
//   const { alice, bob } = testingPairs();

// }
