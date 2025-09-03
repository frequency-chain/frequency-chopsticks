import { describe, it, expect } from 'vitest'
import { setStorage, DownwardMessage, } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing'
import { setupContext, testingPairs} from '@acala-network/chopsticks-testing'
import { connectVertical, connectParachains } from '@acala-network/chopsticks'


const { check, checkSystemEvents, checkUmp, checkHrmp } = withExpect(expect);


import networks, { type Network } from './networks.js'

const downwardMessages: DownwardMessage[] = [
  {
    sentAt: 1,
    msg: '0x0210010400010000078155a74e390a1300010000078155a74e39010300286bee0d01000400010100c0cbffafddbe39f71f0190c2369adfc59eaa4c81a308ebcad88cdd9c400ba57c',
  },
]

describe('XCM', async () => {
  let frequency: Network
  let polkadot: Network
  let assetHub: Network
  let networksD: Network

  beforeEach(async () => {
    frequency = await networks.frequency()
    // networksD = await networks.network()
    assetHub = await networks.assetHub()

    polkadot = await networks.polkadot()

    return async () => {
      await frequency.teardown()
      await polkadot.teardown()
    }
  })

  // it('Frequency handles downward messages', async () => {
  //   console.log('Creating new block with downward messages...')
  //   await frequency.chain.newBlock({ downwardMessages })
    
  //   console.log('Checking system events...')
  //   const events = await frequency.api.query.system.events()
  //   console.log('Raw system events:', JSON.stringify(events.toHuman(), null, 2))

    
  //   await checkSystemEvents(frequency).toMatchSnapshot()
  // })

  it('Polkadot send downward messages to frequency', async () => {
    await connectVertical(polkadot.chain, frequency.chain)

    const { alice } = testingPairs()

    polkadot.dev.setStorage({
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
    })

    await polkadot.api.tx.xcmPallet
      .reserveTransferAssets(
        { V0: { X1: { Parachain: 2000 } } },
        {
          V0: {
            X1: {
              AccountId32: {
                network: 'Any',
                id: alice.addressRaw,
              },
            },
          },
        },
        {
          V0: [
            {
              ConcreteFungible: { id: 'Null', amount: 100e10 },
            },
          ],
        },
        0,
      )
      .signAndSend(alice)

    await polkadot.chain.newBlock()
    await checkSystemEvents(polkadot).toMatchSnapshot()

      console.log('taco-Frequency Events:')
    let result = await checkSystemEvents(polkadot).value();

    // let upward = await checkUmp(polkadot).value();
    // console.log('taco-Upward:', upward)
    
    result.map((event: any) => {
      console.log('taco-Event:', event)
      // console.log('taco-Event:', JSON.stringify(event.toHuman(), null, 2))
    });

      console.log('taco-Frequency Events After New Block:')
    await frequency.chain.newBlock()
    await checkSystemEvents(frequency).toMatchSnapshot()
  })

  it('frequency send upward messages to Polkadot', async () => {
    await connectVertical(polkadot.chain, frequency.chain)

    const { alice } = testingPairs()

    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
      ForeignAssets: {
        Account: [[
          [
            { 
              parents: 1,
              interior: "Here",
            },
            alice.address
          ],
          {
            balance: 10e10,
            status:  { "Liquid": null },
            reason: {'Consumer': null },
            extra: null,
          }
      ]],
      },
    })

    await check(polkadot.api.query.system.account(alice.address)).toMatchSnapshot()
    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot()
    await check(frequency.api.query.foreignAssets.account(  { 
      parents: 1,
      interior: "Here",
    }, alice.address)).toMatchSnapshot()

    // await frequency.api.tx.xTokens
    //   .transfer(
    //     {
    //       Token: 'DOT',
    //     },
    //     10e10,
    //     {
    //       V1: {
    //         parents: 1,
    //         interior: {
    //           X1: {
    //             AccountId32: {
    //               network: 'Any',
    //               id: alice.addressRaw,
    //             },
    //           },
    //         },
    //       },
    //     },
    //     {
    //       Unlimited: null,
    //     },
    //   )
    //   .signAndSend(alice)

    // await frequency.chain.newBlock()
    // await checkSystemEvents(frequency).toMatchSnapshot()
    // await check(frequency.api.query.tokens.accounts(alice.address, { token: 'DOT' })).toMatchSnapshot()

    // await polkadot.chain.newBlock()

    // await check(polkadot.api.query.system.account(alice.address)).toMatchSnapshot()
    // await checkSystemEvents(polkadot).toMatchSnapshot()
  })

  it.only("frequency send horizontal messages to AssetHub", async () => {
    await connectParachains([frequency.chain, assetHub.chain])

    const { alice } = testingPairs()
    
    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
      ForeignAssets: {
        Account: [[
          [
            { 
              parents: 1,
              interior: "Here",
            },
            alice.address
          ],
          {
            balance: 10e10,
            status:  { "Liquid": null },
            reason: {'Consumer': null },
            extra: null,
          }
      ]],
      },
    })


    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot()
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot()
    await check(frequency.api.query.foreignAssets.account(  { 
      parents: 1,
      interior: "Here",
    }, alice.address)).toMatchSnapshot()
  
    await frequency.api.tx.polkadotXcm
      .limitedReserveTransferAssets(
        { 
          V3: { 
            parents: 1, 
            interior: { X1: { Parachain: 1000 } } 
          } 
        },
        { 
          V3: { 
            parents: 0, 
            interior: { 
              X1: { 
                AccountId32: { 
                  network: null, 
                  id: alice.addressRaw, // Uint8Array ok
                } 
              } 
            } 
          } 
        },
        { 
          V3: [
            { 
              id: { 
                Concrete: { 
                  parents: 1, 
                  interior: { Here: null } 
                } 
              }, 
              fun: { Fungible: 5e10 } 
            }
          ] 
        },
        0,
        'Unlimited'
      )
      .signAndSend(alice)

   // 3. Check HRMP messages (before block creation)
    await checkHrmp(frequency).toMatchSnapshot("outbound-hrmp-messages")

    // 4. Check initial events (before block creation)
    await checkSystemEvents(frequency).toMatchSnapshot('initial-events')

      // 5. Create block on source chain (sends the
    await frequency.chain.newBlock()


    // 6. Check source chain events after sending
    await checkSystemEvents(frequency).toMatchSnapshot('events-after-sending')

    // 7. Create block on destination chain (receives
    await assetHub.chain.newBlock()

    // 8. Check destination chain events after receiving
    await checkSystemEvents(assetHub).toMatchSnapshot('events-after-receiving')

    // 9. Verify balance changes on destination chain
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot("final-balance")
    //  await checkHrmp(frequency).toMatchSnapshot()
    // await checkSystemEvents(frequency).toMatchSnapshot()
    // await frequency.chain.newBlock();
    // await checkSystemEvents(frequency).toMatchSnapshot()
    // await check(frequency.api.query.foreignAssets.account(  { 
    //   parents: 1,
    //   interior: "Here",
    // }, alice.address)).toMatchSnapshot()

    // await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot()
  })
})