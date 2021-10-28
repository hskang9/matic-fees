import React, { useState, useEffect } from 'react';
import { FiatOptions } from '../pages/Landing';
import { Web3Provider } from '@ethersproject/providers';
import { Landing, LandingEmpty, LandingLoading } from '../pages/Landing';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { useWeb3React } from '@web3-react/core';

import styled from 'styled-components';

const Container = styled.div`
	position: relative;
	transition: 0.5s ease all;
	background-color: ${(props) => props.theme.colors.background};
	font-family: 'Poppins', sans-serif;
	font-weight: 500;
	min-height: 100vh;
`;

const POLYSCAN_KEY = 'JFX625BH8B6W5UNKUSHA2776HEMQV4KHHT';

type Transaction = {
	value: string;
	gas: string;
	gasPrice: string;
	isError: string;
	cumulativeGasUsed: string;
	gasUsed: string;
};

type TransactionsResponse = {
	status: string;
	result: string | Transaction[];
};

type CoinGeckoResp = {
	'shiden': {
		usd: string;
	};
};

async function makeRequest<T>(path: string): Promise<T> {
	try {
		const resp = await fetch(path);

		const respData = await resp.json();

		if (respData.error) {
			throw new Error(respData.error);
		}

		return respData;
	} catch (e) {
		throw e;
	}
}

const calcGasFees = (used: number[], prices: number[]) => {
	let sum = 0;
	for (let i = 0; i < used.length; i++) {
		sum = sum + used[i] * prices[i];
	}

	return sum;
};

const calcFailedCost = (txs: Transaction[]) => {
	let sum = 0;
	for (let i = 0; i < txs.length; i++) {
		if (Number.parseInt(txs[i].isError) !== 0) {
			console.log(txs[i].isError);
			sum = sum + Number.parseFloat(txs[i].gasPrice) * Number.parseFloat(txs[i].gasUsed);
		}
	}

	return sum;
};

export const GasCalculator = () => {
	const { account, active } = useWeb3React<Web3Provider>();
	const [isLoading, setIsLoading] = useState(false);
	const [gasStats, setGasStats] = useState({
		gasFeeShiden: 0,
		gasFiat: 0,
		fiatSymbol: FiatOptions.USD,
		totalGas: 0,
		totalTx: 0,
		gasPerTx: 0,
		failedTxs: 0,
		failedCost: 0,
	});

	useEffect(() => {
		if (!account || !active) {
			return;
		}

		setIsLoading(true);

		const fetchTxs = async () => {
			try {
				const txsResp = await makeRequest<TransactionsResponse>(
					`https://blockscout.com/astar/shiden/api?module=account&action=txlist&address=${account}&startblock=33333&endblock=99999999&sort=asc`,
				);

				const txs = txsResp.result;

				if (typeof txs === 'string') {
					throw new Error('bad request!');
				}

				const totalTx = txs.length;

				const allGasUsed = txs.map((t) => Number.parseFloat(t.gasUsed));
				const allGasPrices = txs.map((t) => Number.parseFloat(t.gasPrice));
				const totalGasFees = calcGasFees(allGasUsed, allGasPrices) * 1e-18;
				const totalGas = allGasUsed.reduce((acc, cur) => acc + cur, 0);

				const shidenPriceResp = await makeRequest<CoinGeckoResp>(
					`https://api.coingecko.com/api/v3/simple/price?ids=shiden&vs_currencies=usd`,
				);
				const curshidenPrice = Number.parseFloat(shidenPriceResp['shiden']['usd']);
				const failedTxs = txs.filter((t) => Number.parseInt(t.isError) !== 0).length;
				const failedCost = calcFailedCost(txs) * 1e-18;

				setGasStats({
					gasFeeShiden: totalGasFees,
					gasFiat: totalGasFees * curshidenPrice,
					fiatSymbol: FiatOptions.USD,
					totalGas,
					totalTx,
					gasPerTx: (allGasPrices.reduce((acc, cur) => acc + cur, 0) / totalTx) * 1e-9,
					failedTxs,
					failedCost,
				});
			} catch (e) {
				console.error(e);
			}
		};

		fetchTxs();
		setTimeout(() => setIsLoading(false), 500);
		// setIsLoading(false);
	}, [account, active]);

	return (
		<Container>
			<Navbar />
			{account && active ? (
				isLoading ? (
					<LandingLoading />
				) : (
					<Landing {...gasStats} />
				)
			) : (
				<LandingEmpty />
			)}
			<Footer />
		</Container>
	);
};
