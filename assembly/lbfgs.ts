/* Heavily modified from:
 * RISO: an implementation of distributed belief networks. (Copyright 1999, Robert Dodier).
 *
 * License: Apache license, version 2.
 */

import {
  getParam,
  setParam,
  evaluateLoss,
  evaluateGradient,
  newStaticArray,
} from "./util"

@inline const gtol: f64 = 0.9
@inline const STPMIN: f64 = 1e-20
@inline const STPMAX: f64 = 1e20
@inline const xtol: f64 = 1e-16
@inline const ftol: f64 = 0.0001
@inline const maxfev: i32 = 20
@inline const p5: f64 = 0.5
@inline const p66: f64 = 0.66
@inline const xtrapf: f64 = 4

@unmanaged @final
class LBFGS
{
	private stp1: f64;
	private ys: f64;
	private yy: f64;
	private yr: f64;
	private iter: i32;
	private point: i32;
	private ispt: i32;
	private iypt: i32;
	private bound: i32;
	private npt: i32;

	private inmc: i32;

	private info: i32;
	private stp: f64;
	private nfev: i32;
	private w: StaticArray<f64>;
	private m: i32;
	private n: i32;
	private eps: f64;
	private diag: StaticArray<f64>;
	private x: StaticArray<f64>;

	/*  m The number of corrections used in the BFGS update.
	*		Values of less than 3 are not recommended;
	*		large values will result in excessive
	*		computing time. 3-7 is recommended.
	*
	*	 eps Determines the accuracy with which the solution
	*		is to be found. The subroutine terminates when
	*       ||G|| < eps * max(1,||X||)
	*/

	public constructor(x: StaticArray<f64>, m: i32, eps: f64) {
		this.x = x;
		this.m = m;
		const n = this.n = x.length;
		this.eps = eps;

		this.w = newStaticArray<f64>(n*(2*m+1)+2*m);

		this.iter = 0;
		this.point= 0;

		this.diag = newStaticArray<f64>(n);
		for (let i = 0 ; i < n ; i += 1 )
			this.diag [i] = 1;

		this.ispt= n+2*m;
		this.iypt= this.ispt+n*m;
	}

	public apply (f: f64, g: StaticArray<f64>): boolean
	{
	  const n = this.n;
		const w = this.w;

		let execute_entire_while_loop = false;
		if ( this.iter == 0 )
		{
			//initialize
			for (let i = 0 ; i < n ; i += 1 )
			{
				w[this.ispt + i] = -g[i] * this.diag[i];
			}

			const gnorm: f64 = Math.sqrt ( LBFGS.ddot ( n , g , 0, 1 , g , 0, 1 ) );
			this.stp1= 1/gnorm;
			execute_entire_while_loop = true;
		}

		while ( true )
		{
			if ( execute_entire_while_loop )
			{
				this.iter= this.iter+1;
				this.info=0;
				this.bound=this.iter-1;
				if ( this.iter != 1 )
				{
					if ( this.iter > this.m ) this.bound = this.m;
					this.ys = LBFGS.ddot ( n , w , this.iypt + this.npt , 1 , w , this.ispt + this.npt , 1 );
					this.yy = LBFGS.ddot ( n , w , this.iypt + this.npt , 1 , w , this.iypt + this.npt , 1 );

					for ( let i = 0 ; i < n ; i += 1 )
						this.diag [i] = this.ys / this.yy;
				}
			}

			if ( execute_entire_while_loop)
			{
				if ( this.iter != 1 )
				{
					let cp: i32 = this.point;
					if ( this.point == 0 ) cp = this.m;
					w [ n + cp -1] = 1 / this.ys;

					for ( let i = 0 ; i < n ; i += 1 )
					{
						w[i] = -g[i];
					}

					cp= this.point;

					for ( let i = 0 ; i < this.bound ; i += 1 )
					{
						cp=cp-1;
						if ( cp == - 1 ) cp = this.m - 1;
						const sq: f64 = LBFGS.ddot ( n , w , this.ispt + cp * n , 1 , w , 0 , 1 );
						this.inmc=n+this.m+cp;
						let iycn: i32 =this.iypt+cp*n;
						w [this.inmc] = w [n + cp] * sq;
						LBFGS.daxpy ( n , -w[this.inmc] , w , iycn , 1 , w , 0 , 1 );
					}

					for ( let i = 0 ; i < n ; i += 1 )
					{
						w [i] = this.diag [i] * w[i];
					}

					for ( let i = 0 ; i < this.bound ; i += 1 )
					{
						this.yr = LBFGS.ddot ( n , w , this.iypt + cp * n , 1 , w , 0 , 1 );
						let beta: f64 = w [ n + cp] * this.yr;
						this.inmc=n+this.m+cp;
						beta = w [this.inmc] - beta;
						let iscn: i32 =this.ispt+cp*n;
						LBFGS.daxpy ( n , beta , w , iscn , 1 , w , 0 , 1 );
						cp=cp+1;
						if ( cp == this.m ) cp = 0;
					}

					for ( let i = 0 ; i < n ; i += 1 )
					{
						w[this.ispt + this.point * n + i] = w[i];
					}
				}

				this.nfev=0;
				this.stp=1;
				if ( this.iter == 1 ) this.stp = this.stp1;

				for (let i = 0; i < n; i += 1 )
				{
					w[i] = g[i];
				}
			}

			this.mcsrch(f , g);

			if ( this.info == -1 )
				return false;

			this.npt=this.point*n;

			for ( let i = 0 ; i < n ; i += 1 )
			{
				w [ this.ispt + this.npt + i] = this.stp * w [ this.ispt + this.npt + i];
				w [ this.iypt + this.npt + i] = g [i] - w[i];
			}

			this.point=this.point+1;
			if ( this.point == this.m ) this.point = 0;

			const gnorm: f64 = Math.sqrt ( LBFGS.ddot ( n , g , 0 , 1 , g , 0 , 1 ) );
			let xnorm: f64 = Math.sqrt ( LBFGS.ddot ( n , this.x , 0 , 1 , this.x , 0 , 1 ) );
			xnorm = Math.max ( 1.0 , xnorm );

			if ( gnorm / xnorm <= this.eps )
				return true;

			execute_entire_while_loop = true;		// from now on, execute whole loop
		}
	}

	private dg: f64;
	private dgm: f64;
	private dginit: f64;
	private dgtest: f64;
	private finit: f64;
	private ftest1: f64;
	private fm: f64;
	private stmin: f64;
	private stmax: f64;
	private width: f64;
	private width1: f64;

	private stage1: boolean = false;

	private infoc: i32;
	private brackt: boolean = false;

	private dgx: StaticArray<f64> = newStaticArray<f64>(1);
	private dgy: StaticArray<f64> = newStaticArray<f64>(1);
	private fx: StaticArray<f64> = newStaticArray<f64>(1);
	private fy: StaticArray<f64> = newStaticArray<f64>(1);

	private dgxm: StaticArray<f64> = newStaticArray<f64>(1);
	private dgym: StaticArray<f64> = newStaticArray<f64>(1);
	private fxm: StaticArray<f64> = newStaticArray<f64>(1);
	private fym: StaticArray<f64> = newStaticArray<f64>(1);

	private stx: f64;
	private sty: f64;

	private mcsrch (f: f64 , g: StaticArray<f64>): void
	{
	  const n = this.n;
		const w = this.w;
		const is0: i32 = this.ispt + this.point * n;
		if ( this.info != - 1 )
		{
			this.infoc = 1;

			// Compute the initial gradient in the search direction
			// and check that s is a descent direction.

			this.dginit = 0;

			for ( let j = 0 ; j < n ; j += 1 )
				this.dginit = this.dginit + g [j] * w[is0+j];

			if ( this.dginit >= 0 )
				throw new RuntimeException("dginit");

			this.brackt = false;
			this.stage1 = true;
			this.nfev = 0;
			this.finit = f;
			this.dgtest = ftol*this.dginit;
			this.width = STPMAX - STPMIN;
			this.width1 = this.width/p5;

			for ( let j = 0 ; j < n ; j += 1 )
				this.diag[j] = this.x[j];

			// The variables stx, fx, dgx contain the values of the step,
			// function, and directional derivative at the best step.
			// The variables sty, fy, dgy contain the value of the step,
			// function, and derivative at the other endpoint of
			// the interval of uncertainty.
			// The variables stp, f, dg contain the values of the step,
			// function, and derivative at the current step.

			this.stx = 0;
			this.fx[0] = this.finit;
			this.dgx[0] = this.dginit;
			this.sty = 0;
			this.fy[0] = this.finit;
			this.dgy[0] = this.dginit;
		}

		while ( true )
		{
			if ( this.info != -1 )
			{
				// Set the minimum and maximum steps to correspond
				// to the present interval of uncertainty.

				if ( this.brackt )
				{
					this.stmin = Math.min ( this.stx , this.sty );
					this.stmax = Math.max ( this.stx , this.sty );
				}
				else
				{
					this.stmin = this.stx;
					this.stmax = this.stp + xtrapf * ( this.stp - this.stx );
				}

				// Force the step to be within the bounds stmax and stmin.
				this.stp = Math.max ( this.stp , STPMIN );
				this.stp = Math.min ( this.stp , STPMAX );

				// If an unusual termination is to occur then let
				// stp be the lowest point obtained so far.

				if ( ( this.brackt && ( this.stp <= this.stmin || this.stp >= this.stmax ) ) || this.nfev >= maxfev - 1 || this.infoc == 0 || ( this.brackt && this.stmax - this.stmin <= xtol * this.stmax ) ) this.stp = this.stx;

				// Evaluate the function and gradient at stp
				// and compute the directional derivative.
				// We return to main program to obtain F and G.

				for (let j = 0; j < n ; j += 1 )
					this.x [j] = this.diag[j] + this.stp * w[ is0+j];

				this.info=-1;
				return;
			}

			this.info=0;
			this.nfev = this.nfev + 1;
			this.dg = 0;

			for (let j = 0 ; j < n ; j += 1 )
			{
				this.dg = this.dg + g [ j] * w [ is0+j];
			}

			this.ftest1 = this.finit + this.stp*this.dgtest;

			// Test for convergence.

			if ( ( this.brackt && ( this.stp <= this.stmin || this.stp >= this.stmax ) ) || this.infoc == 0 ) this.info = 6;

			if ( this.stp == STPMAX && f <= this.ftest1 && this.dg <= this.dgtest ) this.info = 5;

			if ( this.stp == STPMIN && ( f > this.ftest1 || this.dg >= this.dgtest ) ) this.info = 4;

			if ( this.nfev >= maxfev ) this.info = 3;

			if ( this.brackt && this.stmax - this.stmin <= xtol * this.stmax ) this.info = 2;

			if ( f <= this.ftest1 && Math.abs ( this.dg ) <= gtol * ( - this.dginit ) ) this.info = 1;

			// Check for termination.

			if ( this.info != 0 ) return;

			// In the first stage we seek a step for which the modified
			// function has a nonpositive value and nonnegative derivative.

			if ( this.stage1 && f <= this.ftest1 && this.dg >= Math.min ( ftol , gtol ) * this.dginit ) this.stage1 = false;

			// A modified function is used to predict the step only if
			// we have not obtained a step for which the modified
			// function has a nonpositive function value and nonnegative
			// derivative, and if a lower function value has been
			// obtained but the decrease is not sufficient.

			if ( this.stage1 && f <= this.fx[0] && f > this.ftest1 )
			{
				// Define the modified function and derivative values.

				this.fm = f - this.stp*this.dgtest;
				this.fxm[0] = this.fx[0] - this.stx*this.dgtest;
				this.fym[0] = this.fy[0] - this.sty*this.dgtest;
				this.dgm = this.dg - this.dgtest;
				this.dgxm[0] = this.dgx[0] - this.dgtest;
				this.dgym[0] = this.dgy[0] - this.dgtest;

				// Call cstep to update the interval of uncertainty
				// and to compute the new step.

				this.mcstep (this.fxm , this.dgxm , this.fym , this.dgym , this.fm , this.dgm);

				// Reset the function and gradient values for f.

				this.fx[0] = this.fxm[0] + this.stx*this.dgtest;
				this.fy[0] = this.fym[0] + this.sty*this.dgtest;
				this.dgx[0] = this.dgxm[0] + this.dgtest;
				this.dgy[0] = this.dgym[0] + this.dgtest;
			}
			else
			{
				// Call mcstep to update the interval of uncertainty
				// and to compute the new step.

				this.mcstep (this.fx , this.dgx , this.fy , this.dgy , f , this.dg);
			}

			// Force a sufficient decrease in the size of the
			// interval of uncertainty.

			if ( this.brackt )
			{
				if ( Math.abs ( this.sty - this.stx ) >= p66 * this.width1 )
					this.stp = this.stx + p5 * ( this.sty - this.stx );
				this.width1 = this.width;
				this.width = Math.abs ( this.sty - this.stx );
			}
		}
	}

	/** The purpose of this function is to compute a safeguarded step for
	  * a linesearch and to update an interval of uncertainty for
	  * a minimizer of the function.<p>
	  *
	  * The parameter <code>stx</code> contains the step with the least function
	  * value. The parameter <code>stp</code> contains the current step. It is
	  * assumed that the derivative at <code>stx</code> is negative in the
	  * direction of the step. If <code>brackt</code> is <code>true</code>
	  * when <code>mcstep</code> returns then a
	  * minimizer has been bracketed in an interval of uncertainty
	  * with endpoints <code>stx</code> and <code>sty</code>.<p>
	  *
	  * Variables that must be modified by <code>mcstep</code> are
	  * implemented as 1-element arrays.
	  *
	  * @param stx Step at the best step obtained so far.
	  *   This variable is modified by <code>mcstep</code>.
	  * @param fx Function value at the best step obtained so far.
	  *   This variable is modified by <code>mcstep</code>.
	  * @param dx Derivative at the best step obtained so far. The derivative
	  *   must be negative in the direction of the step, that is, <code>dx</code>
	  *   and <code>stp-stx</code> must have opposite signs.
	  *   This variable is modified by <code>mcstep</code>.
	  *
	  * @param sty Step at the other endpoint of the interval of uncertainty.
	  *   This variable is modified by <code>mcstep</code>.
	  * @param fy Function value at the other endpoint of the interval of uncertainty.
	  *   This variable is modified by <code>mcstep</code>.
	  * @param dy Derivative at the other endpoint of the interval of
	  *   uncertainty. This variable is modified by <code>mcstep</code>.
	  *
	  * @param stp Step at the current step. If <code>brackt</code> is set
	  *   then on input <code>stp</code> must be between <code>stx</code>
	  *   and <code>sty</code>. On output <code>stp</code> is set to the
	  *   new step.
	  * @param fp Function value at the current step.
	  * @param dp Derivative at the current step.
	  *
	  * @param brackt Tells whether a minimizer has been bracketed.
	  *   If the minimizer has not been bracketed, then on input this
	  *   variable must be set <code>false</code>. If the minimizer has
	  *   been bracketed, then on output this variable is <code>true</code>.
	  *
	  * @param stmin Lower bound for the step.
	  * @param stmax Upper bound for the step.
	  *
	  * @param info On return from <code>mcstep</code>, this is set as follows:
	  *   If <code>info</code> is 1, 2, 3, or 4, then the step has been
	  *   computed successfully. Otherwise <code>info</code> = 0, and this
	  *   indicates improper input parameters.
	  *
	  * @author Jorge J. More, David J. Thuente: original Fortran version,
	  *   as part of Minpack project. Argonne Nat'l Laboratory, June 1983.
	  *   Robert Dodier: Java translation, August 1997.
	  */
	  private mcstep (fx: StaticArray<f64> , dx: StaticArray<f64> , fy: StaticArray<f64> , dy: StaticArray<f64> , fp: f64 , dp: f64): void
	  {
		let bound: boolean = false;
		let gamma: f64; let p: f64; let q: f64; let r: f64; let s: f64; let sgnd: f64; let stpc: f64; let stpf: f64; let stpq: f64; let theta: f64;

		this.infoc = 0;


		if ( ( this.brackt && ( this.stp <= Math.min ( this.stx , this.sty ) || this.stp >= Math.max ( this.stx , this.sty ) ) ) || dx[0] * ( this.stp - this.stx ) >= 0.0 || this.stmax < this.stmin ) return;

		// Determine if the derivatives have opposite sign.

		sgnd = dp * ( dx[0] / Math.abs ( dx[0] ) );

		if ( fp > fx[0] )
		{
			// First case. A higher function value.
			// The minimum is bracketed. If the cubic step is closer
			// to stx than the quadratic step, the cubic step is taken,
			// else the average of the cubic and quadratic steps is taken.


			this.infoc = 1;
			bound = true;
			theta = 3 * ( fx[0] - fp ) / ( this.stp - this.stx ) + dx[0] + dp;
			s = LBFGS.max3 ( Math.abs ( theta ) , Math.abs ( dx[0] ) , Math.abs ( dp ) );
			gamma = s * Math.sqrt ( LBFGS.sqr( theta / s ) - ( dx[0] / s ) * ( dp / s ) );
			if ( this.stp < this.stx ) gamma = - gamma;
			p = ( gamma - dx[0] ) + theta;
			q = ( ( gamma - dx[0] ) + gamma ) + dp;
			r = p/q;
			stpc = this.stx + r * ( this.stp - this.stx );
			stpq = this.stx + ( ( dx[0] / ( ( fx[0] - fp ) / ( this.stp - this.stx ) + dx[0] ) ) / 2 ) * ( this.stp - this.stx );
			if ( Math.abs ( stpc - this.stx ) < Math.abs ( stpq - this.stx ) )
			{
				stpf = stpc;
			}
			else
			{
				stpf = stpc + ( stpq - stpc ) / 2;
			}
			this.brackt = true;
		}
		else if ( sgnd < 0.0 )
		{
			// Second case. A lower function value and derivatives of
			// opposite sign. The minimum is bracketed. If the cubic
			// step is closer to stx than the quadratic (secant) step,
			// the cubic step is taken, else the quadratic step is taken.
			this.infoc = 2;
			bound = false;
			theta = 3 * ( fx[0] - fp ) / ( this.stp - this.stx ) + dx[0] + dp;
			s = LBFGS.max3 ( Math.abs ( theta ) , Math.abs ( dx[0] ) , Math.abs ( dp ) );
			gamma = s * Math.sqrt ( LBFGS.sqr( theta / s ) - ( dx[0] / s ) * ( dp / s ) );
			if ( this.stp > this.stx ) gamma = - gamma;
			p = ( gamma - dp ) + theta;
			q = ( ( gamma - dp ) + gamma ) + dx[0];
			r = p/q;
			stpc = this.stp + r * ( this.stx - this.stp );
			stpq = this.stp + ( dp / ( dp - dx[0] ) ) * ( this.stx - this.stp );
			if ( Math.abs ( stpc - this.stp ) > Math.abs ( stpq - this.stp ) )
			{
				stpf = stpc;
			}
			else
			{
				stpf = stpq;
			}
			this.brackt = true;
		}
		else if ( Math.abs ( dp ) < Math.abs ( dx[0] ) )
		{
			// Third case. A lower function value, derivatives of the
			// same sign, and the magnitude of the derivative decreases.
			// The cubic step is only used if the cubic tends to infinity
			// in the direction of the step or if the minimum of the cubic
			// is beyond stp. Otherwise the cubic step is defined to be
			// either stmin or stmax. The quadratic (secant) step is also
			// computed and if the minimum is bracketed then the the step
			// closest to stx is taken, else the step farthest away is taken.

			this.infoc = 3;
			bound = true;
			theta = 3 * ( fx[0] - fp ) / ( this.stp - this.stx ) + dx[0] + dp;
			s = LBFGS.max3 ( Math.abs ( theta ) , Math.abs ( dx[0] ) , Math.abs ( dp ) );
			gamma = s * Math.sqrt ( Math.max ( 0, LBFGS.sqr( theta / s ) - ( dx[0] / s ) * ( dp / s ) ) );
			if ( this.stp > this.stx ) gamma = - gamma;
			p = ( gamma - dp ) + theta;
			q = ( gamma + ( dx[0] - dp ) ) + gamma;
			r = p/q;
			if ( r < 0.0 && gamma != 0.0 )
			{
				stpc = this.stp + r * ( this.stx - this.stp );
			}
			else if ( this.stp > this.stx )
			{
				stpc = this.stmax;
			}
			else
			{
				stpc = this.stmin;
			}
			stpq = this.stp + ( dp / ( dp - dx[0] ) ) * ( this.stx - this.stp );
			if ( this.brackt )
			{
				if ( Math.abs ( this.stp - stpc ) < Math.abs ( this.stp - stpq ) )
				{
					stpf = stpc;
				}
				else
				{
					stpf = stpq;
				}
			}
			else
			{
				if ( Math.abs ( this.stp - stpc ) > Math.abs ( this.stp - stpq ) )
				{
					stpf = stpc;
				}
				else
				{
					stpf = stpq;
				}
			}
		}
		else
		{
			// Fourth case. A lower function value, derivatives of the
			// same sign, and the magnitude of the derivative does
			// not decrease. If the minimum is not bracketed, the step
			// is either stmin or stmax, else the cubic step is taken.
			this.infoc = 4;
			bound = false;
			if ( this.brackt )
			{
				theta = 3 * ( fp - fy[0] ) / ( this.sty - this.stp ) + dy[0] + dp;
				s = LBFGS.max3 ( Math.abs ( theta ) , Math.abs ( dy[0] ) , Math.abs ( dp ) );
				gamma = s * Math.sqrt ( LBFGS.sqr( theta / s ) - ( dy[0] / s ) * ( dp / s ) );
				if ( this.stp > this.sty ) gamma = - gamma;
				p = ( gamma - dp ) + theta;
				q = ( ( gamma - dp ) + gamma ) + dy[0];
				r = p/q;
				stpc = this.stp + r * ( this.sty - this.stp );
				stpf = stpc;
			}
			else if ( this.stp > this.stx )
			{
				stpf = this.stmax;
			}
			else
			{
				stpf = this.stmin;
			}
		}

		// Update the interval of uncertainty. This update does not
		// depend on the new step or the case analysis above.

		if ( fp > fx[0] )
		{
			this.sty = this.stp;
			fy[0] = fp;
			dy[0] = dp;
		}
		else
		{
			if ( sgnd < 0.0 )
			{
				this.sty = this.stx;
				fy[0] = fx[0];
				dy[0] = dx[0];
			}
			this.stx = this.stp;
			fx[0] = fp;
			dx[0] = dp;
		}

		// Compute the new step and safeguard it.

		stpf = Math.min ( this.stmax , stpf );
		stpf = Math.max ( this.stmin , stpf );
		this.stp = stpf;

		if ( this.brackt && bound )
		{
			if ( this.sty > this.stx )
			{
				this.stp = Math.min ( this.stx + 0.66 * ( this.sty - this.stx ) , this.stp );
			}
			else
			{
				this.stp = Math.max ( this.stx + 0.66 * ( this.sty - this.stx ) , this.stp );
			}
		}

		return;
	}

	/** Compute the sum of a vector times a scalar plus another vector.
	  * Adapted from the subroutine <code>daxpy</code> in <code>lbfgs.f</code>.
	  * There could well be faster ways to carry out this operation; this
	  * code is a straight translation from the Fortran.
	  */
	public static daxpy ( n: i32 , da: f64 , dx: StaticArray<f64> , ix0: i32, incx: i32 , dy: StaticArray<f64> , iy0: i32, incy: i32 ): void
	{
		let i: i32; let ix: i32; let iy: i32; let m: i32; let mp1: i32;

		if ( n <= 0 ) return;

		if ( da == 0 ) return;

		if  ( ! ( incx == 1 && incy == 1 ) )
		{
			ix = 1;
			iy = 1;

			if ( incx < 0 ) ix = ( - n + 1 ) * incx + 1;
			if ( incy < 0 ) iy = ( - n + 1 ) * incy + 1;

			for ( i = 1 ; i <= n ; i += 1 )
			{
				dy [ iy0+iy -1] = dy [ iy0+iy -1] + da * dx [ ix0+ix -1];
				ix = ix + incx;
				iy = iy + incy;
			}

			return;
		}

		m = n % 4;
		if ( m != 0 )
		{
			for ( i = 1 ; i <= m ; i += 1 )
			{
				dy [ iy0+i -1] = dy [ iy0+i -1] + da * dx [ ix0+i -1];
			}

			if ( n < 4 ) return;
		}

		mp1 = m + 1;
		for ( i = mp1 ; i <= n ; i += 4 )
		{
			dy [ iy0+i -1] = dy [ iy0+i -1] + da * dx [ ix0+i -1];
			dy [ iy0+i + 1 -1] = dy [ iy0+i + 1 -1] + da * dx [ ix0+i + 1 -1];
			dy [ iy0+i + 2 -1] = dy [ iy0+i + 2 -1] + da * dx [ ix0+i + 2 -1];
			dy [ iy0+i + 3 -1] = dy [ iy0+i + 3 -1] + da * dx [ ix0+i + 3 -1];
		}
		return;
	}

	/** Compute the dot product of two vectors.
	  * Adapted from the subroutine <code>ddot</code> in <code>lbfgs.f</code>.
	  * There could well be faster ways to carry out this operation; this
	  * code is a straight translation from the Fortran.
	  */
	public static ddot ( n: i32, dx: StaticArray<f64>, ix0: i32, incx: i32, dy: StaticArray<f64>, iy0: i32, incy: i32 ): f64
	{
		let dtemp: f64;
		let i: i32; let ix: i32; let iy: i32; let m: i32; let mp1: i32;

		dtemp = 0;

		if ( n <= 0 ) return 0;

		if ( !( incx == 1 && incy == 1 ) )
		{
			ix = 1;
			iy = 1;
			if ( incx < 0 ) ix = ( - n + 1 ) * incx + 1;
			if ( incy < 0 ) iy = ( - n + 1 ) * incy + 1;
			for ( i = 1 ; i <= n ; i += 1 )
			{
				dtemp = dtemp + dx [ ix0+ix -1] * dy [ iy0+iy -1];
				ix = ix + incx;
				iy = iy + incy;
			}
			return dtemp;
		}

		m = n % 5;
		if ( m != 0 )
		{
			for ( i = 1 ; i <= m ; i += 1 )
			{
				dtemp = dtemp + dx [ ix0+i -1] * dy [ iy0+i -1];
			}
			if ( n < 5 ) return dtemp;
		}

		mp1 = m + 1;
		for ( i = mp1 ; i <= n ; i += 5 )
		{
			dtemp = dtemp + dx [ ix0+i -1] * dy [ iy0+i -1] + dx [ ix0+i + 1 -1] * dy [ iy0+i + 1 -1] + dx [ ix0+i + 2 -1] * dy [ iy0+i + 2 -1] + dx [ ix0+i + 3 -1] * dy [ iy0+i + 3 -1] + dx [ ix0+i + 4 -1] * dy [ iy0+i + 4 -1];
		}

		return dtemp;
	}

	static sqr( x: f64 ): f64 { return x*x; }
	static max3( x: f64, y: f64, z: f64 ): f64 { return x < y ? ( y < z ? z : y ) : ( x < z ? z : x ); }
}

export function optimize(
  numFreeParams: u32,
  iterations: u32,
  learningRate: f64,
  epsilon: f64,
  gamma: f64,
): void {
  const x = newStaticArray<f64>(numFreeParams)
  const g = newStaticArray<f64>(numFreeParams)

  const m = 5
  const eps = 0.1
  const lb = new LBFGS(x, m, eps)

  let zz: f64 = 99
  let complete: boolean

  x[0] = 0.1
  g[0] = 2 * x[0]
  complete = lb.apply(x[0] * x[0], g)
  console.log('------>' + x[0].toString())

  g[0] = 2 * x[0]
  complete = lb.apply(x[0] * x[0], g)
  console.log(x[0].toString())
  console.log('------>' + x[0].toString())

  g[0] = 2 * x[0]
  complete = lb.apply(x[0] * x[0], g)
  console.log(x[0].toString())
}
